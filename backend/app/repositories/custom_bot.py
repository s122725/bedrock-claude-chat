import asyncio
import base64
import json
import logging
import os
from datetime import datetime
from decimal import Decimal as decimal
from functools import partial

import boto3
from app.config import DEFAULT_GENERATION_CONFIG as DEFAULT_CLAUDE_GENERATION_CONFIG
from app.config import DEFAULT_SEARCH_CONFIG
from app.repositories.common import (
    RecordNotFoundError,
    _get_table_client,
    _get_table_public_client,
    compose_bot_id,
    decompose_bot_id,
)
from app.repositories.models.custom_bot import (
    BotMeta,
    BotMetaWithStackInfo,
    BotModel,
    GenerationParamsModel,
    KnowledgeModel,
    SearchParamsModel,
)
from app.repositories.models.custom_bot_kb import BedrockKnowledgeBaseModel
from app.routes.schemas.bot import type_sync_status
from app.utils import get_current_time
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("TABLE_NAME", "")

DEFAULT_GENERATION_CONFIG = DEFAULT_CLAUDE_GENERATION_CONFIG

logger = logging.getLogger(__name__)
sts_client = boto3.client("sts")


def store_bot(user_id: str, custom_bot: BotModel):
    table = _get_table_client(user_id)
    logger.info(f"Storing bot: {custom_bot}")

    item = {
        "PK": user_id,
        "SK": compose_bot_id(user_id, custom_bot.id),
        "Title": custom_bot.title,
        "Description": custom_bot.description,
        "Instruction": custom_bot.instruction,
        "CreateTime": decimal(custom_bot.create_time),
        "LastBotUsed": decimal(custom_bot.last_used_time),
        "IsPinned": custom_bot.is_pinned,
        "GenerationParams": custom_bot.generation_params.model_dump(),
        "SearchParams": custom_bot.search_params.model_dump(),
        "Knowledge": custom_bot.knowledge.model_dump(),
        "SyncStatus": custom_bot.sync_status,
        "SyncStatusReason": custom_bot.sync_status_reason,
        "LastExecId": custom_bot.sync_last_exec_id,
        "DisplayRetrievedChunks": custom_bot.display_retrieved_chunks,
    }
    if custom_bot.bedrock_knowledge_base:
        item["BedrockKnowledgeBase"] = custom_bot.bedrock_knowledge_base.model_dump()

    response = table.put_item(Item=item)
    return response


def update_bot(
    user_id: str,
    bot_id: str,
    title: str,
    description: str,
    instruction: str,
    generation_params: GenerationParamsModel,
    search_params: SearchParamsModel,
    knowledge: KnowledgeModel,
    sync_status: type_sync_status,
    sync_status_reason: str,
    display_retrieved_chunks: bool,
    bedrock_knowledge_base: BedrockKnowledgeBaseModel | None = None,
):
    """Update bot title, description, and instruction.
    NOTE: Use `update_bot_visibility` to update visibility.
    """
    table = _get_table_client(user_id)
    logger.info(f"Updating bot: {bot_id}")

    update_expression = (
        "SET Title = :title, "
        "Description = :description, "
        "Instruction = :instruction, "
        "Knowledge = :knowledge, "
        "SyncStatus = :sync_status, "
        "SyncStatusReason = :sync_status_reason, "
        "GenerationParams = :generation_params, "
        "SearchParams = :search_params, "
        "DisplayRetrievedChunks = :display_retrieved_chunks, "
    )

    expression_attribute_values = {
        ":title": title,
        ":description": description,
        ":instruction": instruction,
        ":knowledge": knowledge.model_dump(),
        ":sync_status": sync_status,
        ":sync_status_reason": sync_status_reason,
        ":display_retrieved_chunks": display_retrieved_chunks,
        ":generation_params": generation_params.model_dump(),
        ":search_params": search_params.model_dump(),
    }
    if bedrock_knowledge_base:
        update_expression += ", BedrockKnowledgeBase = :bedrock_knowledge_base"
        expression_attribute_values[":bedrock_knowledge_base"] = (
            bedrock_knowledge_base.model_dump()
        )

    try:
        response = table.update_item(
            Key={"PK": user_id, "SK": compose_bot_id(user_id, bot_id)},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW",
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise RecordNotFoundError(f"Bot with id {bot_id} not found")
        else:
            raise e

    return response

def update_bot_last_used_time(user_id: str, bot_id: str):
    """Update last used time for bot."""
    table = _get_table_client(user_id)
    logger.info(f"Updating last used time for bot: {bot_id}")
    try:
        response = table.update_item(
            Key={"PK": user_id, "SK": compose_bot_id(user_id, bot_id)},
            UpdateExpression="SET LastBotUsed = :val",
            ExpressionAttributeValues={":val": decimal(get_current_time())},
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise RecordNotFoundError(f"Bot with id {bot_id} not found")
        else:
            raise e
    return response


def update_bot_pin_status(user_id: str, bot_id: str, pinned: bool):
    """Update pin status for bot."""
    table = _get_table_client(user_id)
    logger.info(f"Updating pin status for bot: {bot_id}")
    try:
        response = table.update_item(
            Key={"PK": user_id, "SK": compose_bot_id(user_id, bot_id)},
            UpdateExpression="SET IsPinned = :val",
            ExpressionAttributeValues={":val": pinned},
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise RecordNotFoundError(f"Bot with id {bot_id} not found")
        else:
            raise e
    return response

def update_knowledge_base_id(
    user_id: str, bot_id: str, knowledge_base_id: str, data_source_ids: list[str]
):
    table = _get_table_client(user_id)
    logger.info(f"Updating knowledge base id for bot: {bot_id}")

    try:
        response = table.update_item(
            Key={"PK": user_id, "SK": compose_bot_id(user_id, bot_id)},
            UpdateExpression="SET BedrockKnowledgeBase.knowledge_base_id = :kb_id, BedrockKnowledgeBase.data_source_ids = :ds_ids",
            ExpressionAttributeValues={
                ":kb_id": knowledge_base_id,
                ":ds_ids": data_source_ids,
            },
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
            ReturnValues="ALL_NEW",
        )
        logger.info(f"Updated knowledge base id for bot: {bot_id} successfully")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise RecordNotFoundError(f"Bot with id {bot_id} not found")
        else:
            raise e

    return response


def find_private_bots_by_user_id(
    user_id: str, limit: int | None = None
) -> list[BotMeta]:
    """Find all private bots owned by user.
    This does not include public bots.
    The order is descending by `last_used_time`.
    """
    table = _get_table_client(user_id)
    logger.info(f"Finding bots for user: {user_id}")

    query_params = {
        "IndexName": "LastBotUsedIndex",
        "KeyConditionExpression": Key("PK").eq(user_id),
        "ScanIndexForward": False,
    }

    response = table.query(**query_params)
    bots = [
        BotMeta(
            id=decompose_bot_id(item["SK"]),
            title=item["Title"],
            create_time=float(item["CreateTime"]),
            last_used_time=float(item["LastBotUsed"]),
            available=True,
            is_pinned=item["IsPinned"],
            description=item["Description"],
            sync_status=item["SyncStatus"],
        )
        for item in response["Items"]
    ]

    query_count = 1
    MAX_QUERY_COUNT = 5
    while "LastEvaluatedKey" in response:
        query_params["ExclusiveStartKey"] = response["LastEvaluatedKey"]
        response = table.query(**query_params)
        bots.extend(
            [
                BotMeta(
                    id=decompose_bot_id(item["SK"]),
                    title=item["Title"],
                    create_time=float(item["CreateTime"]),
                    last_used_time=float(item["LastBotUsed"]),
                    available=True,
                    is_pinned=item["IsPinned"],
                    description=item["Description"],
                    sync_status=item["SyncStatus"],
                )
                for item in response["Items"]
            ]
        )
        query_count += 1
        if limit and len(bots) >= limit:
            # NOTE: `Limit` in query params is evaluated after filter expression.
            # So limit manually here.
            break
        if query_count > MAX_QUERY_COUNT:
            logger.warning(f"Query count exceeded {MAX_QUERY_COUNT}")
            break

    if limit:
        bots = bots[:limit]

    logger.info(f"Found all private bots: {bots}")
    return bots


def find_private_bot_by_id(user_id: str, bot_id: str) -> BotModel:
    """Find private bot."""
    table = _get_table_client(user_id)
    logger.info(f"Finding bot with id: {bot_id}")
    response = table.query(
        IndexName="SKIndex",
        KeyConditionExpression=Key("SK").eq(compose_bot_id(user_id, bot_id)),
    )
    if len(response["Items"]) == 0:
        raise RecordNotFoundError(f"Bot with id {bot_id} not found")
    item = response["Items"][0]

    bot = BotModel(
        id=decompose_bot_id(item["SK"]),
        title=item["Title"],
        description=item["Description"],
        instruction=item["Instruction"],
        create_time=float(item["CreateTime"]),
        last_used_time=float(item["LastBotUsed"]),
        is_pinned=item["IsPinned"],
        owner_user_id=user_id,
        generation_params=GenerationParamsModel(
            **(
                item["GenerationParams"]
                if "GenerationParams" in item
                else DEFAULT_GENERATION_CONFIG
            )
        ),
        search_params=SearchParamsModel(
            max_results=(
                item["SearchParams"]["max_results"]
                if "SearchParams" in item
                else DEFAULT_SEARCH_CONFIG["max_results"]
            )
        ),
        knowledge=KnowledgeModel(
            **{**item["Knowledge"], "s3_urls": item["Knowledge"].get("s3_urls", [])}
        ),
        sync_status=item["SyncStatus"],
        sync_status_reason=item["SyncStatusReason"],
        sync_last_exec_id=item["LastExecId"],
        display_retrieved_chunks=item.get("DisplayRetrievedChunks", False),
        bedrock_knowledge_base=(
            BedrockKnowledgeBaseModel(**item["BedrockKnowledgeBase"])
            if "BedrockKnowledgeBase" in item
            else None
        ),
    )

    logger.info(f"Found bot: {bot}")
    return bot

def delete_bot_by_id(user_id: str, bot_id: str):
    table = _get_table_client(user_id)
    logger.info(f"Deleting bot with id: {bot_id}")

    try:
        response = table.delete_item(
            Key={"PK": user_id, "SK": compose_bot_id(user_id, bot_id)},
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise RecordNotFoundError(f"Bot with id {bot_id} not found")
        else:
            raise e

    return response

async def find_public_bots_by_ids(bot_ids: list[str]) -> list[BotMetaWithStackInfo]:
    """Find all public bots by ids. This method is intended for administrator use."""
    table = _get_table_public_client()
    loop = asyncio.get_running_loop()

    def query_dynamodb(table, bot_id):
        response = table.query(
            IndexName="PublicBotIdIndex",
            KeyConditionExpression=Key("PublicBotId").eq(bot_id),
        )
        return response["Items"]

    tasks = [
        loop.run_in_executor(None, partial(query_dynamodb, table, bot_id))
        for bot_id in bot_ids
    ]
    results = await asyncio.gather(*tasks)

    bots = []
    for items in results:
        for item in items:
            bots.append(
                BotMetaWithStackInfo(
                    id=decompose_bot_id(item["SK"]),
                    owner_user_id=item["PK"],
                    title=item["Title"],
                    create_time=float(item["CreateTime"]),
                    last_used_time=float(item["LastBotUsed"]),
                    available=True,
                    is_pinned=item["IsPinned"],
                    description=item["Description"],
                    sync_status=item["SyncStatus"],
                )
            )

    return bots
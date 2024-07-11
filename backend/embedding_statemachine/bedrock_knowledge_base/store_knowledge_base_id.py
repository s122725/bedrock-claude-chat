import os
import json
import logging

import boto3
from retry import retry
from app.routes.schemas.bot import type_sync_status
from app.repositories.common import _get_table_client
from app.repositories.custom_bot import decompose_bot_id, update_knowledge_base_id
from typing import TypedDict

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class StackOutput(TypedDict):
    KnowledgeBaseId: str
    DataSourceId: str


def handler(event, context):
    logger.info(f"Event: {event}")
    pk = event["pk"]
    sk = event["sk"]
    stack_output: list[StackOutput] = event["stack_output"]

    kb_id = stack_output[0]["KnowledgeBaseId"]
    data_source_ids = [x["DataSourceId"] for x in stack_output]

    user_id = pk
    bot_id = decompose_bot_id(sk)

    update_knowledge_base_id(user_id, bot_id, kb_id, data_source_ids)

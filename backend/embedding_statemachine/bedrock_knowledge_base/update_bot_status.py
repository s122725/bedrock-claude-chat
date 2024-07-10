import os
import json
import logging

import boto3
from retry import retry
from app.routes.schemas.bot import type_sync_status
from app.repositories.common import _get_table_client
from app.repositories.custom_bot import (
    compose_bot_id,
    decompose_bot_id,
    find_private_bot_by_id,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')

RETRIES_TO_UPDATE_SYNC_STATUS = 4
RETRY_DELAY_TO_UPDATE_SYNC_STATUS = 2

@retry(tries=RETRIES_TO_UPDATE_SYNC_STATUS, delay=RETRY_DELAY_TO_UPDATE_SYNC_STATUS)
def update_sync_status(
    user_id: str,
    bot_id: str,
    sync_status: type_sync_status,
    sync_status_reason: str,
    last_exec_id: str,
):
    table = _get_table_client(user_id)
    table.update_item(
        Key={"PK": user_id, "SK": compose_bot_id(user_id, bot_id)},
        UpdateExpression="SET SyncStatus = :sync_status, SyncStatusReason = :sync_status_reason, LastExecId = :last_exec_id",
        ExpressionAttributeValues={
            ":sync_status": sync_status,
            ":sync_status_reason": sync_status_reason,
            ":last_exec_id": last_exec_id,
        },
    )

def handler(event, context):
    logger.info(f"Event: {event}")
    try:
        pk = event['pk']
        sk = event['sk']
        sync_status = event['sync_status']
        sync_status_reason = event.get('sync_status_reason', '')
        last_exec_id = event.get('last_exec_id', '')

        user_id = pk
        bot_id = decompose_bot_id(sk)

        logger.info(f"Updating sync status for bot {bot_id} of user {user_id} to {sync_status} with reason: {sync_status_reason}")

        update_sync_status(user_id, bot_id, sync_status, sync_status_reason, last_exec_id)

        return {
            'statusCode': 200,
            'body': json.dumps('Sync status updated successfully.')
        }
    except Exception as e:
        logger.error(f"Error updating sync status: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error updating sync status.')
        }
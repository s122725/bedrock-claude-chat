import boto3
from botocore.exceptions import ClientError
import os
from decimal import Decimal
from app.repositories.common import (
  _get_table_client,
  compose_bot_id
)
from app.utils import get_bedrock_client

def get_guardrails_arn(user_id: str, bot_id: str) -> str:
    table = _get_table_client(user_id)
    try:
        response = table.get_item(
            Key={
                "PK": user_id,
                "SK": compose_bot_id(user_id, bot_id)
            },
            ConsistentRead=True,
        )
        guardrails_arn = response["Item"]["GuardrailsParams"]["guardrails_arn"] if "Item" in response and "GuardrailsParams" in response["Item"] and "guardrails_arn" in response["Item"]["GuardrailsParams"] else ""
        print(guardrails_arn)
        return guardrails_arn
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise (f"Bot with id {bot_id} not found")
        else:
            raise (f"Error getting guardrails_arn for bot: {bot_id}: {e}")

def delete_guardrail(guardrail_id):
  client = get_bedrock_client()
  client.delete_guardrail(guardrailIdentifier=guardrail_id)
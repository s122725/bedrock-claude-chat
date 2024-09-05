from botocore.exceptions import ClientError
from app.repositories.common import _get_table_client, compose_bot_id
from app.utils import get_bedrock_client


class BotNotFoundException(Exception):
    pass


class GuardrailArnRetrievalError(Exception):
    pass


def get_guardrail_arn(user_id: str, bot_id: str) -> str:
    table = _get_table_client(user_id)
    try:
        response = table.get_item(
            Key={"PK": user_id, "SK": compose_bot_id(user_id, bot_id)},
            ConsistentRead=True,
        )
        guardrail_arn = (
            response["Item"]["GuardrailsParams"]["guardrail_arn"]
            if "Item" in response
            and "GuardrailsParams" in response["Item"]
            and "guardrail_arn" in response["Item"]["GuardrailsParams"]
            else ""
        )
        print(guardrail_arn)
        return guardrail_arn
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise BotNotFoundException(f"Bot with id {bot_id} not found")
        else:
            raise GuardrailArnRetrievalError(
                f"Error getting guardrail_arn for bot: {bot_id}: {e}"
            )


def delete_guardrail(guardrail_id):
    client = get_bedrock_client()
    client.delete_guardrail(guardrailIdentifier=guardrail_id)

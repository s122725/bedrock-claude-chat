from decimal import Decimal
from app.routes.schemas.base import BaseSchema


class BedrockGuardrailsInput(BaseSchema):
    is_guardrail_enabled: bool
    hate_threshold: Decimal
    insults_threshold: Decimal
    sexual_threshold: Decimal
    violence_threshold: Decimal
    misconduct_threshold: Decimal
    grounding_threshold: Decimal
    relevance_threshold: Decimal
    guardrail_arn: str
    guardrail_version: str


class BedrockGuardrailsOutput(BaseSchema):
    is_guardrail_enabled: bool
    hate_threshold: Decimal
    insults_threshold: Decimal
    sexual_threshold: Decimal
    violence_threshold: Decimal
    misconduct_threshold: Decimal
    grounding_threshold: Decimal
    relevance_threshold: Decimal
    guardrail_arn: str
    guardrail_version: str

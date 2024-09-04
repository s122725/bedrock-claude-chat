from decimal import Decimal
from pydantic import BaseModel

class BedrockGuardrailsModel(BaseModel):
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
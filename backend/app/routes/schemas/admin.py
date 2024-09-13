from app.routes.schemas.base import BaseSchema
from app.routes.schemas.bot import Knowledge, type_sync_status
from pydantic import Field


class UsagePerBotOutput(BaseSchema):
    id: str = Field(..., description="bot_id")
    title: str
    description: str
    owner_user_id: str
    # model_id: str
    total_price: float


class UsagePerUserOutput(BaseSchema):
    id: str = Field(..., description="user_id")
    email: str
    total_price: float

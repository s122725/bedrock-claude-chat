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


class PublicBotOutput(BaseSchema):
    id: str
    title: str
    instruction: str
    description: str
    create_time: float
    last_used_time: float
    owner_user_id: str
    knowledge: Knowledge
    sync_status: type_sync_status
    sync_status_reason: str
    sync_last_exec_id: str

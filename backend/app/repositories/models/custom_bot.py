from app.repositories.models.common import Float
from app.repositories.models.custom_bot_kb import BedrockKnowledgeBaseModel
from app.routes.schemas.bot import type_sync_status
from pydantic import BaseModel


class KnowledgeModel(BaseModel):
    filenames: list[str]
    s3_urls: list[str]

class GenerationParamsModel(BaseModel):
    max_tokens: int
    top_k: int
    top_p: Float
    temperature: Float
    stop_sequences: list[str]


class SearchParamsModel(BaseModel):
    max_results: int


class ConversationQuickStarterModel(BaseModel):
    title: str
    example: str


class BotModel(BaseModel):
    id: str
    title: str
    description: str
    instruction: str
    create_time: float
    last_used_time: float
    owner_user_id: str
    is_pinned: bool
    generation_params: GenerationParamsModel
    search_params: SearchParamsModel
    knowledge: KnowledgeModel
    sync_status: type_sync_status
    sync_status_reason: str
    sync_last_exec_id: str
    display_retrieved_chunks: bool
    conversation_quick_starters: list[ConversationQuickStarterModel]
    bedrock_knowledge_base: BedrockKnowledgeBaseModel | None

    def has_knowledge(self) -> bool:
        return (
            len(self.knowledge.filenames) > 0
            or len(self.knowledge.s3_urls) > 0
        )

    def has_bedrock_knowledge_base(self) -> bool:
        return self.bedrock_knowledge_base is not None


class BotAliasModel(BaseModel):
    id: str
    title: str
    description: str
    original_bot_id: str
    create_time: float
    last_used_time: float
    is_pinned: bool
    sync_status: type_sync_status
    has_knowledge: bool
    conversation_quick_starters: list[ConversationQuickStarterModel]


class BotMeta(BaseModel):
    id: str
    title: str
    description: str
    create_time: float
    last_used_time: float
    is_pinned: bool
    # Whether the bot is owned by the user
    owned: bool
    # Whether the bot is available or not.
    # This can be `False` if the bot is not owned by the user and original bot is removed.
    available: bool
    sync_status: type_sync_status
    has_bedrock_knowledge_base: bool


class BotMetaWithStackInfo(BotMeta):
    owner_user_id: str

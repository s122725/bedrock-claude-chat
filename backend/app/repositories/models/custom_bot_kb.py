from pydantic import BaseModel
from app.routes.schemas.bot_kb import type_kb_chunking_strategy, type_kb_embeddings_model, type_os_character_filter, type_os_tokenizer, type_os_token_filter


class AnalyzerParamsModel(BaseModel):
    character_filters: list[type_os_character_filter]
    tokenizer: type_os_tokenizer
    token_filters: list[type_os_token_filter]


class OpenSearchParamsModel(BaseModel):
    analyzer: AnalyzerParamsModel | None

class BedrockKnowledgeBaseModel(BaseModel):
    embeddings_model: type_kb_embeddings_model
    open_search: OpenSearchParamsModel
    chunking_strategy: type_kb_chunking_strategy
    max_tokens: int | None = None
    overlap_percentage: int | None = None
    instruction: str | None = None
    knowledge_base_id: str | None = None
    data_source_ids: list[str] | None = None

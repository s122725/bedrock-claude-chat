from typing import Literal
from app.routes.schemas.base import BaseSchema

# Ref: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_ChunkingConfiguration.html
type_kb_chunking_strategy = Literal["default", "fixed_size", "none"]
type_kb_embeddings_model = Literal["titan_v1", "cohere_multilingual_v3"]

# OpenSearch Serverless Analyzer
# Ref: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-genref.html
type_os_character_filter = Literal["icu_normalizer"]
type_os_tokenizer = Literal["kuromoji_tokenizer", "icu_tokenizer"]
type_os_token_filter = Literal[
    "kuromoji_baseform",
    "kuromoji_part_of_speech",
    "kuromoji_stemmer",
    "cjk_width",
    "ja_stop",
    "lowercase",
    'icu_folding'
]

class AnalyzerParams(BaseSchema):
    character_filters: list[type_os_character_filter]
    tokenizer: type_os_tokenizer
    token_filters: list[type_os_token_filter]


class OpenSearchParams(BaseSchema):
    analyzer: AnalyzerParams


class BedrockKnowledgeBaseInput(BaseSchema):
    embeddings_model: type_kb_embeddings_model
    open_search: OpenSearchParams
    chunking_strategy: type_kb_chunking_strategy
    max_tokens: int | None = None
    overlap_percentage: int | None = None
    instruction: str | None = None

class BedrockKnowledgeBaseOutput(BaseSchema):
    embeddings_model: type_kb_embeddings_model
    open_search: OpenSearchParams
    chunking_strategy: type_kb_chunking_strategy
    max_tokens: int | None = None
    overlap_percentage: int | None = None
    instruction: str | None = None
    knowledge_base_id: str | None = None
    data_source_ids: list[str] | None = None
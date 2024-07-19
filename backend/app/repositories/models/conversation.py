import base64
from typing import Literal

from app.routes.schemas.conversation import Content, MessageInput, type_model_name
from pydantic import BaseModel, Field


class ContentModel(BaseModel):
    content_type: Literal["text", "image", "attachment"]
    media_type: str | None
    body: str = Field(
        ...,
        description="Body string. If content_type is attachment, it should be base64 encoded.",
    )
    file_name: str | None = Field(None)

    @classmethod
    def from_content(cls, content: Content) -> "ContentModel":
        body = content.body
        if isinstance(body, bytes):
            body = base64.b64encode(body).decode()
        return cls(
            content_type=content.content_type,
            media_type=content.media_type,
            body=body,  # type: ignore
            file_name=content.file_name,
        )


class FeedbackModel(BaseModel):
    thumbs_up: bool
    category: str
    comment: str


class ChunkModel(BaseModel):
    content: str
    content_type: str
    source: str
    rank: int


class MessageModel(BaseModel):
    role: str
    content: list[ContentModel]
    model: type_model_name
    children: list[str]
    parent: str | None
    create_time: float
    feedback: FeedbackModel | None
    used_chunks: list[ChunkModel] | None
    thinking_log: str | None = Field(None, description="Only available for agent.")

    @classmethod
    def from_message_input(cls, message_input: MessageInput):
        return MessageModel(
            role=message_input.role,
            content=[
                ContentModel.from_content(content) for content in message_input.content
            ],
            model=message_input.model,
            children=[],
            parent=message_input.parent_message_id,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )


class ConversationModel(BaseModel):
    id: str
    create_time: float
    title: str
    total_price: float
    message_map: dict[str, MessageModel]
    last_message_id: str
    bot_id: str | None
    should_continue: bool


class ConversationMeta(BaseModel):
    id: str
    title: str
    create_time: float
    model: str
    bot_id: str | None

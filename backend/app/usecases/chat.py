import logging
from copy import deepcopy
from typing import Literal

from app.bedrock import (
    call_converse_api,
    compose_args_for_converse_api,
)
from app.prompt import build_rag_prompt
from app.repositories.conversation import (
    RecordNotFoundError,
    find_conversation_by_id,
)
from app.repositories.custom_bot import find_alias_by_id, store_alias
from app.repositories.models.conversation import (
    ContentModel,
    ConversationModel,
    MessageModel,
)
from app.repositories.models.custom_bot import (
    BotAliasModel,
    BotModel,
    ConversationQuickStarterModel,
)
from app.routes.schemas.conversation import (
    ChatInput,
    Chunk,
    Content,
    Conversation,
    FeedbackOutput,
    MessageOutput,
    RelatedDocumentsOutput,
)
from app.usecases.bot import fetch_bot
from app.utils import get_current_time
from app.vector_search import (
    SearchResult,
    get_source_link,
    search_related_docs,
)
from ulid import ULID

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def prepare_conversation(
    user_id: str,
    chat_input: ChatInput,
) -> tuple[str, ConversationModel, BotModel | None]:
    current_time = get_current_time()
    bot = None

    try:
        # Fetch existing conversation
        conversation = find_conversation_by_id(user_id, chat_input.conversation_id)
        logger.info(f"Found conversation: {conversation}")
        parent_id = chat_input.message.parent_message_id
        if chat_input.message.parent_message_id == "system" and chat_input.bot_id:
            # The case editing first user message and use bot
            parent_id = "instruction"
        elif chat_input.message.parent_message_id is None:
            parent_id = conversation.last_message_id
        if chat_input.bot_id:
            logger.info("Bot id is provided. Fetching bot.")
            owned, bot = fetch_bot(user_id, chat_input.bot_id)
    except RecordNotFoundError:
        # The case for new conversation. Note that editing first user message is not considered as new conversation.
        logger.info(
            f"No conversation found with id: {chat_input.conversation_id}. Creating new conversation."
        )

        initial_message_map = {
            # Dummy system message, which is used for root node of the message tree.
            "system": MessageModel(
                role="system",
                content=[
                    ContentModel(
                        content_type="text",
                        media_type=None,
                        body="",
                        file_name=None,
                    )
                ],
                model=chat_input.message.model,
                children=[],
                parent=None,
                create_time=current_time,
                feedback=None,
                used_chunks=None,
                thinking_log=None,
            )
        }
        parent_id = "system"
        if chat_input.bot_id:
            logger.info("Bot id is provided. Fetching bot.")
            parent_id = "instruction"
            # Fetch bot and append instruction
            owned, bot = fetch_bot(user_id, chat_input.bot_id)
            initial_message_map["instruction"] = MessageModel(
                role="instruction",
                content=[
                    ContentModel(
                        content_type="text",
                        media_type=None,
                        body=bot.instruction,
                        file_name=None,
                    )
                ],
                model=chat_input.message.model,
                children=[],
                parent="system",
                create_time=current_time,
                feedback=None,
                used_chunks=None,
                thinking_log=None,
            )
            initial_message_map["system"].children.append("instruction")

            if not owned:
                try:
                    # Check alias is already created
                    find_alias_by_id(user_id, chat_input.bot_id)
                except RecordNotFoundError:
                    logger.info(
                        "Bot is not owned by the user. Creating alias to shared bot."
                    )
                    # Create alias item
                    store_alias(
                        user_id,
                        BotAliasModel(
                            id=bot.id,
                            title=bot.title,
                            description=bot.description,
                            original_bot_id=chat_input.bot_id,
                            create_time=current_time,
                            last_used_time=current_time,
                            is_pinned=False,
                            sync_status=bot.sync_status,
                            has_knowledge=bot.has_knowledge(),
                            conversation_quick_starters=(
                                []
                                if bot.conversation_quick_starters is None
                                else [
                                    ConversationQuickStarterModel(
                                        title=starter.title,
                                        example=starter.example,
                                    )
                                    for starter in bot.conversation_quick_starters
                                ]
                            ),
                        ),
                    )

        # Create new conversation
        conversation = ConversationModel(
            id=chat_input.conversation_id,
            title="New conversation",
            total_price=0.0,
            create_time=current_time,
            message_map=initial_message_map,
            last_message_id="",
            bot_id=chat_input.bot_id,
            should_continue=False,
        )

    # Append user chat input to the conversation
    if chat_input.message.message_id:
        message_id = chat_input.message.message_id
    else:
        message_id = str(ULID())
    # If the "Generate continue" button is pressed, a new_message is not generated.
    if not chat_input.continue_generate:
        new_message = MessageModel(
            role=chat_input.message.role,
            content=[
                ContentModel(
                    content_type=c.content_type,
                    media_type=c.media_type,
                    body=c.body,
                    file_name=c.file_name,
                )
                for c in chat_input.message.content
            ],
            model=chat_input.message.model,
            children=[],
            parent=parent_id,
            create_time=current_time,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        conversation.message_map[message_id] = new_message
        conversation.message_map[parent_id].children.append(message_id)  # type: ignore

    return (message_id, conversation, bot)


def trace_to_root(
    node_id: str | None, message_map: dict[str, MessageModel]
) -> list[MessageModel]:
    """Trace message map from leaf node to root node."""
    result = []
    if not node_id or node_id == "system":
        node_id = "instruction" if "instruction" in message_map else "system"

    current_node = message_map.get(node_id)
    while current_node:
        result.append(current_node)
        parent_id = current_node.parent
        if parent_id is None:
            break
        current_node = message_map.get(parent_id)

    return result[::-1]


def insert_knowledge(
    conversation: ConversationModel,
    search_results: list[SearchResult],
    display_citation: bool = True,
) -> ConversationModel:
    """Insert knowledge to the conversation."""
    if len(search_results) == 0:
        return conversation

    inserted_prompt = build_rag_prompt(conversation, search_results, display_citation)
    logger.info(f"Inserted prompt: {inserted_prompt}")

    conversation_with_context = deepcopy(conversation)
    conversation_with_context.message_map["instruction"].content[
        0
    ].body = inserted_prompt

    return conversation_with_context


def propose_conversation_title(
    user_id: str,
    conversation_id: str,
    model: Literal[
        "claude-instant-v1",
        "claude-v2",
        "claude-v3-opus",
        "claude-v3-sonnet",
        "claude-v3.5-sonnet",
        "claude-v3-haiku",
    ] = "claude-v3-haiku",
) -> str:
    PROMPT = """Reading the conversation above, what is the appropriate title for the conversation? When answering the title, please follow the rules below:
<rules>
- Title length must be from 15 to 20 characters.
- Prefer more specific title than general. Your title should always be distinct from others.
- Return the conversation title only. DO NOT include any strings other than the title.
- Title must be in the same language as the conversation.
</rules>
"""
    # Fetch existing conversation
    conversation = find_conversation_by_id(user_id, conversation_id)

    messages = trace_to_root(
        node_id=conversation.last_message_id,
        message_map=conversation.message_map,
    )

    # Append message to generate title
    new_message = MessageModel(
        role="user",
        content=[
            ContentModel(
                content_type="text",
                body=PROMPT,
                media_type=None,
                file_name=None,
            )
        ],
        model=model,
        children=[],
        parent=conversation.last_message_id,
        create_time=get_current_time(),
        feedback=None,
        used_chunks=None,
        thinking_log=None,
    )
    messages.append(new_message)

    # Invoke Bedrock
    args = compose_args_for_converse_api(
        messages=messages,
        model=model,
    )
    response = call_converse_api(args)
    reply_txt = response["output"]["message"]["content"][0]["text"]

    return reply_txt


def fetch_conversation(user_id: str, conversation_id: str) -> Conversation:
    conversation = find_conversation_by_id(user_id, conversation_id)

    message_map = {
        message_id: MessageOutput(
            role=message.role,
            content=[
                Content(
                    content_type=c.content_type,
                    body=c.body,
                    media_type=c.media_type,
                    file_name=c.file_name,
                )
                for c in message.content
            ],
            model=message.model,
            children=message.children,
            parent=message.parent,
            feedback=(
                FeedbackOutput(
                    thumbs_up=message.feedback.thumbs_up,
                    category=message.feedback.category,
                    comment=message.feedback.comment,
                )
                if message.feedback
                else None
            ),
            used_chunks=(
                [
                    Chunk(
                        content=c.content,
                        content_type=c.content_type,
                        source=c.source,
                        rank=c.rank,
                    )
                    for c in message.used_chunks
                ]
                if message.used_chunks
                else None
            ),
        )
        for message_id, message in conversation.message_map.items()
    }
    # Omit instruction
    if "instruction" in message_map:
        for c in message_map["instruction"].children:
            message_map[c].parent = "system"
        message_map["system"].children = message_map["instruction"].children

        del message_map["instruction"]

    output = Conversation(
        id=conversation_id,
        title=conversation.title,
        create_time=conversation.create_time,
        last_message_id=conversation.last_message_id,
        message_map=message_map,
        bot_id=conversation.bot_id,
        should_continue=conversation.should_continue,
    )
    return output


def fetch_related_documents(
    user_id: str, chat_input: ChatInput
) -> list[RelatedDocumentsOutput] | None:
    """Retrieve related documents from vector store.
    If `display_retrieved_chunks` is disabled, return None.
    """
    if not chat_input.bot_id:
        return []

    _, bot = fetch_bot(user_id, chat_input.bot_id)
    if not bot.display_retrieved_chunks:
        return None

    query: str = chat_input.message.content[-1].body  # type: ignore[assignment]
    chunks = search_related_docs(bot=bot, query=query)

    documents = []
    for chunk in chunks:
        content_type, source_link = get_source_link(chunk.source)
        documents.append(
            RelatedDocumentsOutput(
                chunk_body=chunk.content,
                content_type=content_type,
                source_link=source_link,
                rank=chunk.rank,
            )
        )
    return documents

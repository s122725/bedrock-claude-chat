import sys

sys.path.append(".")

import unittest
from pprint import pprint

from app.agents.agent import AgentMessageModel, AgentRunner, OnStopInput
from app.agents.tools.agent_tool import RunResult
from app.agents.tools.internet_search import internet_search_tool
from app.bedrock import ConverseApiToolResult
from app.config import DEFAULT_EMBEDDING_CONFIG
from app.repositories.models.conversation import ContentModel, MessageModel
from app.repositories.models.custom_bot import (
    AgentModel,
    BotModel,
    EmbeddingParamsModel,
    GenerationParamsModel,
    KnowledgeModel,
    SearchParamsModel,
)
from app.routes.schemas.conversation import type_model_name


def on_thinking(conversation: list[AgentMessageModel]):
    print("====================================")
    print("Thinking...")
    print("====================================")
    pprint(conversation)


def on_tool_result(tool_result: ConverseApiToolResult):
    print("====================================")
    print("Tool Result...")
    print("====================================")
    pprint(tool_result["toolUseId"])


def on_stop(on_stop_input: OnStopInput):
    print("====================================")
    print("Stop...")
    print("====================================")
    pprint(on_stop_input)


class TestAgentRunner(unittest.TestCase):
    def setUp(self) -> None:
        bot = BotModel(
            id="dummy",
            title="Japanese Dishes",
            description="Japanese Delicious Dishes",
            instruction="",
            create_time=1627984879.9,
            last_used_time=1627984879.9,
            # Pinned
            is_pinned=True,
            public_bot_id=None,
            owner_user_id="dummy",
            embedding_params=EmbeddingParamsModel(
                chunk_size=DEFAULT_EMBEDDING_CONFIG["chunk_size"],
                chunk_overlap=DEFAULT_EMBEDDING_CONFIG["chunk_overlap"],
                enable_partition_pdf=False,
            ),
            generation_params=GenerationParamsModel(
                max_tokens=2000,
                top_k=250,
                top_p=0.999,
                temperature=0.6,
                stop_sequences=["Human: ", "Assistant: "],
            ),
            search_params=SearchParamsModel(
                max_results=20,
            ),
            agent=AgentModel(tools=[]),
            knowledge=KnowledgeModel(
                source_urls=[""],
                sitemap_urls=[""],
                filenames=[
                    "Ramen.pdf",
                    "Sushi.pdf",
                    "Yakiniku.pdf",
                ],
                s3_urls=[],
            ),
            display_retrieved_chunks=True,
            sync_status="RUNNING",
            sync_status_reason="reason",
            sync_last_exec_id="",
            published_api_stack_name=None,
            published_api_datetime=None,
            published_api_codebuild_id=None,
            conversation_quick_starters=[],
            bedrock_knowledge_base=None,
        )
        tools = [internet_search_tool]
        model = "claude-v3-sonnet"
        self.runner = AgentRunner(
            bot=bot,
            tools=tools,
            model=model,
            on_thinking=on_thinking,
            on_tool_result=on_tool_result,
            on_stop=on_stop,
        )
        self.model: type_model_name = model

    def test_run(self):
        message = MessageModel(
            role="user",
            content=[
                ContentModel(
                    content_type="text",
                    media_type=None,
                    body="今日の東京の天気?あと宮崎の天気も",
                    file_name=None,
                )
            ],
            model=self.model,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        res = self.runner.run(messages=[message])
        print("====================================")
        pprint(res)


# class TestReactAgent(unittest.TestCase):
#     MODEL = "claude-v3-sonnet"

#     def test_create_react_agent(self):
#         llm = BedrockLLM.from_model(model=self.MODEL)
#         bot = BotModel(
#             id="dummy",
#             title="Japanese Dishes",
#             description="Japanese Delicious Dishes",
#             instruction="",
#             create_time=1627984879.9,
#             last_used_time=1627984879.9,
#             # Pinned
#             is_pinned=True,
#             public_bot_id=None,
#             owner_user_id="dummy",
#             embedding_params=EmbeddingParamsModel(
#                 chunk_size=DEFAULT_EMBEDDING_CONFIG["chunk_size"],
#                 chunk_overlap=DEFAULT_EMBEDDING_CONFIG["chunk_overlap"],
#                 enable_partition_pdf=False,
#             ),
#             generation_params=GenerationParamsModel(
#                 max_tokens=2000,
#                 top_k=250,
#                 top_p=0.999,
#                 temperature=0.6,
#                 stop_sequences=["Human: ", "Assistant: "],
#             ),
#             search_params=SearchParamsModel(
#                 max_results=20,
#             ),
#             agent=AgentModel(tools=[]),
#             knowledge=KnowledgeModel(
#                 source_urls=[""],
#                 sitemap_urls=[""],
#                 filenames=[
#                     "Ramen.pdf",
#                     "Sushi.pdf",
#                     "Yakiniku.pdf",
#                 ],
#                 s3_urls=[],
#             ),
#             display_retrieved_chunks=True,
#             sync_status="RUNNING",
#             sync_status_reason="reason",
#             sync_last_exec_id="",
#             published_api_stack_name=None,
#             published_api_datetime=None,
#             published_api_codebuild_id=None,
#             conversation_quick_starters=[],
#             bedrock_knowledge_base=None,
#         )
#         answer_with_knowledge_tool = AnswerWithKnowledgeTool.from_bot(
#             bot=bot,
#             llm=llm,
#         )
#         tools = []
#         tools.append(answer_with_knowledge_tool)  # RAG Tool

#         agent = create_react_agent(model=self.MODEL, tools=tools)
#         executor = AgentExecutor(
#             name="Agent Executor",
#             agent=agent,
#             return_intermediate_steps=True,
#             tools=tools,
#             callbacks=[],
#             verbose=False,
#             max_iterations=15,
#             max_execution_time=None,
#             early_stopping_method="force",
#             handle_parsing_errors=True,
#         )

#         with get_token_count_callback() as token_cb, get_used_chunk_callback() as chunk_cb:
#             res = executor.invoke(
#                 {
#                     # "input": "Tell me the today's weather with temperature on Seattle and Tokyo. Output must be in a table format."
#                     # "input": "東京とシアトルの今日の天気と気温を教えてください。出力は表形式である必要があります。"
#                     "input": "ラーメンとはなんですか？"
#                 },
#                 config={
#                     "callbacks": [
#                         ApigwWebsocketCallbackHandler(
#                             gatewayapi="dummy", connection_id="dummy", debug=True
#                         ),
#                         token_cb,
#                         chunk_cb,
#                     ],
#                 },
#             )
#             print(f"Total Input Token Count: {token_cb.total_input_token_count}")
#             print(f"Total Output Token Count: {token_cb.total_output_token_count}")
#             print(f"Total Cost (USD): ${token_cb.total_cost}")
#             print(f"Used Chunks: {chunk_cb.used_chunks}")

#         print(f"type of res: {type(res)}")
#         # pprint(res)
#         print(f"type of intermediate_steps: {type(res.get('intermediate_steps'))}")


if __name__ == "__main__":
    unittest.main()

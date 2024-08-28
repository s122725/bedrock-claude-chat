from app.agents.tools.agent_tool import AgentTool, RunResult
from app.bedrock import ConverseApiResponse, get_bedrock_client, get_model_id
from app.repositories.models.conversation import MessageModel
from app.repositories.models.custom_bot import BotModel
from app.routes.schemas.conversation import type_model_name


class AgentRunner:
    def __init__(self, bot: BotModel, tools: list[AgentTool], model: type_model_name):
        self.bot = bot
        self.tools = {tool.name: tool for tool in tools}
        self.client = get_bedrock_client()
        self.model_id = get_model_id(model)

    # def run(self, conversation: list[MessageModel]) -> ConverseApiResponse:
    def run(self, conversation: list[MessageModel]):
        args = self._compose_args(conversation)
        response = self.client.converse(**args)
        # return self._process_response(response)

    def _compose_args(self, conversation: list[MessageModel]) -> dict:
        arg_messages = [
            {
                "role": message.role,
                "content": [
                    {"text": c.body}
                    for c in message.content
                    if c.content_type == "text"
                ],
            }
            for message in conversation
        ]

        args = {
            "modelId": self.model_id,
            "messages": arg_messages,
            "toolConfig": self._get_tool_config(),
            "inferenceConfig": {
                "maxTokens": self.bot.generation_params.max_tokens,
                "temperature": self.bot.generation_params.temperature,
                "topP": self.bot.generation_params.top_p,
                "stopSequences": self.bot.generation_params.stop_sequences,
            },
            "system": [{"text": self.bot.instruction}] if self.bot.instruction else [],
        }
        return args

    def _get_tool_config(self) -> dict:
        return {"tools": [tool.to_converse_spec() for tool in self.tools.values()]}

    def _process_response(self, response: ConverseApiResponse) -> list[MessageModel]:
        new_messages: list[MessageModel] = []
        # for content_block in response["output"]["message"]["content"]:
        #     if "text" in content_block:
        #         new_messages.append(
        #             MessageModel(
        #                 role="system", content=[{"text": content_block["text"]}]
        #             )
        #         )
        #     if "toolUse" in content_block:
        #         tool_use = content_block["toolUse"]
        #         tool_result = self._invoke_tool(tool_use)
        #         new_messages.append(
        #             MessageModel(role="user", content=[{"json": tool_result}])
        #         )

        return new_messages

    def _invoke_tool(self, tool_use: dict) -> RunResult:
        tool_name = tool_use["name"]
        if tool_name in self.tools:
            tool = self.tools[tool_name]
            args = tool.args_schema(**tool_use["input"])
            return tool.run(args)
        else:
            raise ValueError(f"Tool {tool_name} not found.")

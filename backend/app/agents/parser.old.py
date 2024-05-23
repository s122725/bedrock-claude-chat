import re
from typing import Union

from app.agents.prompt import FORMAT_INSTRUCTIONS
from langchain_core.agents import AgentAction, AgentFinish
from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import BaseOutputParser

# FINAL_ANSWER_ACTION = "Final Answer:"
FINAL_ANSWER_ACTIONS = {
    "Final Answer:",
    "Antwort Finale:",
    "Réponse finale:",
    "Respuesta final:",
    "最終回答:",
    "최종 답변:",
    "最终答案：",
    "最終答案：",
    "Risposta finale:",
}
MISSING_ACTION_AFTER_THOUGHT_ERROR_MESSAGE = (
    "Invalid Format: Missing 'Action:' after 'Thought:"
)
MISSING_ACTION_INPUT_AFTER_ACTION_ERROR_MESSAGE = (
    "Invalid Format: Missing 'Action Input:' after 'Action:'"
)
FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE = (
    "Parsing LLM output produced both a final answer and a parse-able action:"
)


class ReActSingleInputOutputParser(BaseOutputParser):
    """Parses ReAct-style LLM calls that have a single tool input.
    Reference: https://github.com/langchain-ai/langchain/blob/master/libs/langchain/langchain/agents/output_parsers/react_single_input.py

    Expects output to be in one of two formats.

    If the output signals that an action should be taken,
    should be in the below format. This will result in an AgentAction
    being returned.

    ```
    Thought: agent thought here
    Action: search
    Action Input: what is the temperature in SF?
    ```

    If the output signals that a final answer should be given,
    should be in the below format. This will result in an AgentFinish
    being returned.

    ```
    Thought: agent thought here
    Final Answer: The temperature is 100 degrees
    ```

    """

    def get_format_instructions(self) -> str:
        return FORMAT_INSTRUCTIONS

    def parse(self, text: str) -> Union[AgentAction, AgentFinish]:
        # includes_answer = FINAL_ANSWER_ACTION in text
        includes_answer = any(action in text for action in FINAL_ANSWER_ACTIONS)
        regex = (
            r"Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)"
        )
        action_match = re.search(regex, text, re.DOTALL)
        if action_match:
            if includes_answer:
                # raise OutputParserException(
                #     f"{FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE}: {text}"
                # )
                return AgentFinish(
                    # {"output": text.split(FINAL_ANSWER_ACTION)[-1].strip()}, text
                    {
                        "output": text.split(next(iter(FINAL_ANSWER_ACTIONS)))[
                            -1
                        ].strip()
                    },
                    text,
                )
            action = action_match.group(1).strip()
            action_input = action_match.group(2)
            tool_input = action_input.strip(" ")
            tool_input = tool_input.strip('"')

            return AgentAction(action, tool_input, text)

        elif includes_answer:
            return AgentFinish(
                # {"output": text.split(FINAL_ANSWER_ACTION)[-1].strip()}, text
                {"output": text.split(next(iter(FINAL_ANSWER_ACTIONS)))[-1].strip()},
                text,
            )

        if not re.search(r"Action\s*\d*\s*:[\s]*(.*?)", text, re.DOTALL):
            raise OutputParserException(
                f"Could not parse LLM output: `{text}`",
                observation=MISSING_ACTION_AFTER_THOUGHT_ERROR_MESSAGE,
                llm_output=text,
                send_to_llm=True,
            )
        elif not re.search(
            r"[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)", text, re.DOTALL
        ):
            raise OutputParserException(
                f"Could not parse LLM output: `{text}`",
                observation=MISSING_ACTION_INPUT_AFTER_ACTION_ERROR_MESSAGE,
                llm_output=text,
                send_to_llm=True,
            )
        else:
            raise OutputParserException(f"Could not parse LLM output: `{text}`")

    @property
    def _type(self) -> str:
        return "react-single-input"
import sys

sys.path.append(".")

import unittest

from app.agents.langchain import BedrockLLM
from app.routes.schemas.conversation import type_model_name


class TestBedrockLLM(unittest.TestCase):
    MODEL_CLAUDE: type_model_name = "claude-v3-haiku"
    MODEL_MISTRAL: type_model_name = "mistral-7b-instruct"

    def test_invoke(self):
        llm = BedrockLLM.from_model(model=self.MODEL_CLAUDE)
        result = llm.invoke("Hello, World!")
        print(result)

    def test_invoke_stream(self):
        llm = BedrockLLM.from_model(model=self.MODEL_MISTRAL)
        for event in llm.stream("Hello, World!"):
            print(event)


if __name__ == "__main__":
    unittest.main()

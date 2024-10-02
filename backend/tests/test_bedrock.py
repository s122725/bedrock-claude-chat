import sys

sys.path.append(".")

import unittest
from pprint import pprint

from app.bedrock import call_converse_api, compose_args_for_converse_api
from app.repositories.models.conversation import ContentModel, MessageModel
from app.routes.schemas.conversation import type_model_name

MODEL: type_model_name = "claude-v3-haiku"


class TestCallConverseApi(unittest.TestCase):
    def test_call_converse_api(self):
        message = MessageModel(
            role="user",
            content=[
                ContentModel(
                    content_type="text",
                    media_type=None,
                    body="Hello, World!",
                    file_name=None,
                )
            ],
            model=MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        arg = compose_args_for_converse_api(
            [message],
            MODEL,
            instruction=None,
            stream=False,
            generation_params=None,
        )

        response = call_converse_api(arg)
        pprint(response)


if __name__ == "__main__":
    unittest.main()

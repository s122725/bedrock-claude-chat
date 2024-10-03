import sys
import unittest

import boto3
from ulid import ULID

sys.path.append(".")

import base64
from pathlib import Path

from app.bedrock import (
    DEFAULT_GENERATION_CONFIG,
    ConverseApiRequest,
    _convert_to_valid_file_name,
    _get_converse_supported_format,
    compose_args_for_converse_api,
    compose_args_for_converse_api_with_guardrail,
    convert_dict_keys_to_camel_case,
    get_model_id,
)
from app.repositories.models.conversation import ContentModel, MessageModel
from app.repositories.models.custom_bot import GenerationParamsModel
from app.repositories.models.custom_bot_guardrails import BedrockGuardrailsModel
from app.routes.schemas.conversation import type_model_name


def compose_args_for_converse_api_refactored(
    messages: list[MessageModel],
    model: type_model_name,
    instruction: str | None = None,
    stream: bool = False,
    generation_params: GenerationParamsModel | None = None,
    grounding_source: dict | None = None,
    guardrail: BedrockGuardrailsModel | None = None,
) -> ConverseApiRequest:
    def process_content(c: ContentModel, role: str):
        if c.content_type == "text":
            if role == "user" and guardrail and guardrail.grounding_threshold > 0:
                return [
                    {"guardContent": grounding_source},
                    {"guardContent": {"text": {"text": c.body, "qualifiers": ["query"]}}},
                ]
            elif role == "assistant":
                return [
                    {"text": {"content": c.body} if isinstance(c.body, str) else None}
                ]
            else:
                return [{"text": c.body}]
        elif c.content_type == "image":
            format = c.media_type.split("/")[1] if c.media_type else "unknown"
            return [
                {
                    "image": {
                        "format": format,
                        "source": {"bytes": base64.b64decode(c.body)},
                    }
                }
            ]
        elif c.content_type == "attachment":
            return [
                {
                    "document": {
                        "format": _get_converse_supported_format(
                            Path(c.file_name).suffix[1:]
                        ),
                        "name": Path(c.file_name).stem,  # Changed this line
                        "source": {
                            "bytes": (
                                c.body.encode("utf-8")
                                if isinstance(c.body, str)
                                else c.body
                            )
                        },  # And this line
                    }
                }
            ]
        else:
            raise NotImplementedError(f"Unsupported content type: {c.content_type}")

    arg_messages = [
        {
            "role": message.role,
            "content": [
                block
                for c in message.content
                for block in process_content(c, message.role)
            ],
        }
        for message in messages
        if message.role not in ["system", "instruction"]
    ]

    inference_config = {
        **DEFAULT_GENERATION_CONFIG,
        **(
            {
                "maxTokens": generation_params.max_tokens,
                "temperature": generation_params.temperature,
                "topP": generation_params.top_p,
                "stopSequences": generation_params.stop_sequences,
            }
            if generation_params
            else {}
        ),
    }

    additional_model_request_fields = {"top_k": inference_config.pop("top_k")}

    args: ConverseApiRequest = {
        "inference_config": convert_dict_keys_to_camel_case(inference_config),
        "additional_model_request_fields": additional_model_request_fields,
        "model_id": get_model_id(model),
        "messages": arg_messages,
        "stream": stream,
        "system": [{"text": instruction}] if instruction else [],
        "guardrailConfig": None,
    }

    if guardrail and guardrail.guardrail_arn and guardrail.guardrail_version:
        args["guardrailConfig"] = {
            "guardrailIdentifier": guardrail.guardrail_arn,
            "guardrailVersion": guardrail.guardrail_version,
            "trace": "enabled",
            "streamProcessingMode": "async",
        }

    return args


class TestGuardRail(unittest.TestCase):
    MODEL = "claude-v3-haiku"

    def setUp(self):
        self.guardrail = BedrockGuardrailsModel(
            is_guardrail_enabled=True,
            hate_threshold=0,
            insults_threshold=1,
            sexual_threshold=2,
            violence_threshold=3,
            misconduct_threshold=4,
            grounding_threshold=0.1,
            relevance_threshold=0.2,
            guardrail_arn="aws:guardrail:arn:123456789012:guardrail:test-guardrail",
            guardrail_version="v1",
        )
        self.maxDiff = None

    def test_simple(self):
        """最もシンプルなケース"""
        message = message = MessageModel(
            role="user",
            content=[
                ContentModel(
                    content_type="text",
                    media_type=None,
                    body="Hello, World!",
                    file_name=None,
                )
            ],
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": None,
            "stream": False,
            "generation_params": None,
            "guardrail": self.guardrail,
        }

        # リファクタリング前後で同じ結果が得られることを確認
        arg = compose_args_for_converse_api_with_guardrail(**args_for_test)
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        self.assertEqual(arg, arg_ref)

    def test_with_instruction(self):
        """Instructionがある場合"""
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
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        instruction = "いかなる状況でも、大阪弁で回答してください"
        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": instruction,
            "stream": False,
            "generation_params": None,
            "guardrail": self.guardrail,
        }

        arg = compose_args_for_converse_api_with_guardrail(**args_for_test)
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        self.assertEqual(arg, arg_ref)

    def test_with_generation_params(self):
        """GenerationParamsがある場合"""
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
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        generation_params = GenerationParamsModel(
            max_tokens=2000,
            top_k=250,
            top_p=0.999,
            temperature=0.6,
            stop_sequences=["Human: ", "Assistant: "],
        )

        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": None,
            "stream": False,
            "generation_params": generation_params,
            "guardrail": self.guardrail,
        }

        arg = compose_args_for_converse_api_with_guardrail(**args_for_test)
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        self.assertEqual(arg, arg_ref)

    def test_with_grounding_source(self):
        """GroundingSourceがある場合"""
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
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        grounding_source = {
            "text": {"text": "He is a doctor.", "qualifiers": ["grounding_source"]}
        }
        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": None,
            "stream": False,
            "generation_params": None,
            "guardrail": self.guardrail,
            "grounding_source": grounding_source,
        }

        arg = compose_args_for_converse_api_with_guardrail(**args_for_test)
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        self.assertEqual(arg, arg_ref)

    def test_with_image(self):
        """画像がある場合"""
        message = MessageModel(
            role="user",
            content=[
                ContentModel(
                    content_type="image",
                    media_type="image/png",
                    body="iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABbElEQVQ4jY2Tz0sDQRSGv7K7",
                    file_name=None,
                ),
                ContentModel(
                    content_type="text",
                    media_type=None,
                    body="Explain the images.",
                    file_name=None,
                ),
            ],
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": None,
            "stream": False,
            "generation_params": None,
            "guardrail": self.guardrail,
        }
        arg = compose_args_for_converse_api_with_guardrail(**args_for_test)
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        self.assertEqual(arg, arg_ref)

    def test_with_attachment(self):
        """添付ファイルがある場合"""
        message = MessageModel(
            role="user",
            content=[
                ContentModel(
                    content_type="attachment",
                    media_type=None,
                    body="iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABbElEQVQ4jY2Tz0sDQRSGv7K7",
                    file_name="example.pdf",
                ),
                ContentModel(
                    content_type="text",
                    media_type=None,
                    body="Explain the attachment.",
                    file_name=None,
                ),
            ],
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": None,
            "stream": False,
            "generation_params": None,
            "guardrail": self.guardrail,
        }

        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)
        arg = compose_args_for_converse_api_with_guardrail(**args_for_test)

        self.assertEqual(arg, arg_ref)


class TestWithoutGuardRail(unittest.TestCase):
    MODEL = "claude-v3-haiku"

    def setUp(self):
        self.maxDiff = None

    def test_simple(self):
        message = message = MessageModel(
            role="user",
            content=[
                ContentModel(
                    content_type="text",
                    media_type=None,
                    body="Hello, World!",
                    file_name=None,
                )
            ],
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": None,
            "stream": False,
            "generation_params": None,
        }

        # リファクタリング前後で同じ結果が得られることを確認
        arg = compose_args_for_converse_api(**args_for_test)  # Guardrailなし
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        # GuardrailConfigがNoneであることを確認
        self.assertEqual(arg_ref["guardrailConfig"], None)

        # Guardrailなしの場合、argからguardrailConfigを削除してから比較
        del arg_ref["guardrailConfig"]
        self.assertEqual(arg, arg_ref)

    def test_with_instruction(self):
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
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        instruction = "いかなる状況でも、大阪弁で回答してください"
        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": instruction,
            "stream": False,
            "generation_params": None,
        }

        arg = compose_args_for_converse_api(**args_for_test)
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        # GuardrailConfigがNoneであることを確認
        self.assertEqual(arg_ref["guardrailConfig"], None)

        # Guardrailなしの場合、argからguardrailConfigを削除してから比較
        del arg_ref["guardrailConfig"]
        self.assertEqual(arg, arg_ref)

    def test_with_generation_params(self):
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
            model=self.MODEL,
            children=[],
            parent=None,
            create_time=0,
            feedback=None,
            used_chunks=None,
            thinking_log=None,
        )
        generation_params = GenerationParamsModel(
            max_tokens=2000,
            top_k=250,
            top_p=0.999,
            temperature=0.6,
            stop_sequences=["Human: ", "Assistant: "],
        )

        args_for_test = {
            "messages": [message],
            "model": self.MODEL,
            "instruction": None,
            "stream": False,
            "generation_params": generation_params,
        }

        arg = compose_args_for_converse_api(**args_for_test)
        arg_ref = compose_args_for_converse_api_refactored(**args_for_test)

        # GuardrailConfigがNoneであることを確認
        self.assertEqual(arg_ref["guardrailConfig"], None)

        # Guardrailなしの場合、argからguardrailConfigを削除してから比較
        del arg_ref["guardrailConfig"]
        self.assertEqual(arg, arg_ref)


if __name__ == "__main__":
    unittest.main()

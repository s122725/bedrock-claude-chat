import base64
import logging
import os
import re
import pprint
from pathlib import Path
from typing import TypedDict, no_type_check

from config import BEDROCK_PRICING
from config import DEFAULT_GENERATION_CONFIG as DEFAULT_CLAUDE_GENERATION_CONFIG
from repositories.models.conversation import MessageModel
from repositories.models.custom_bot import GenerationParamsModel
from routes.schemas.conversation import type_model_name
from utils import convert_dict_keys_to_camel_case, get_bedrock_client, get_aws_bedrock_client, get_aws_bedrock_agent_client

logger = logging.getLogger(__name__)

BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
DEFAULT_GENERATION_CONFIG = DEFAULT_CLAUDE_GENERATION_CONFIG

client = get_bedrock_client()


class ConverseApiRequest(TypedDict):
    inference_config: dict
    additional_model_request_fields: dict
    model_id: str
    messages: list[dict]
    stream: bool
    system: list[dict]


class ConverseApiResponseMessageContent(TypedDict):
    text: str


class ConverseApiResponseMessage(TypedDict):
    content: list[ConverseApiResponseMessageContent]
    role: str


class ConverseApiResponseOutput(TypedDict):
    message: ConverseApiResponseMessage


class ConverseApiResponseUsage(TypedDict):
    inputTokens: int
    outputTokens: int
    totalTokens: int


class ConverseApiResponse(TypedDict):
    ResponseMetadata: dict
    output: ConverseApiResponseOutput
    stopReason: str
    usage: ConverseApiResponseUsage

def _get_converse_supported_format(ext: str) -> str:
    supported_formats = {
        "pdf": "pdf",
        "csv": "csv",
        "doc": "doc",
        "docx": "docx",
        "xls": "xls",
        "xlsx": "xlsx",
        "html": "html",
        "txt": "txt",
        "md": "md",
    }
    # If the extension is not supported, return "txt"
    return supported_formats.get(ext, "txt")


def _convert_to_valid_file_name(file_name: str) -> str:
    # Note: The document file name can only contain alphanumeric characters,
    # whitespace characters, hyphens, parentheses, and square brackets.
    # The name can't contain more than one consecutive whitespace character.
    file_name = re.sub(r"[^a-zA-Z0-9\s\-\(\)\[\]]", "", file_name)
    file_name = re.sub(r"\s+", " ", file_name)
    file_name = file_name.strip()

    return file_name


@no_type_check
def compose_args_for_converse_api(
    messages: list[MessageModel],
    model: type_model_name,
    instruction: str | None = None,
    stream: bool = False,
    generation_params: GenerationParamsModel | None = None,
) -> ConverseApiRequest:
    """Compose arguments for Converse API.
    Ref: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/bedrock-runtime/client/converse_stream.html
    """
    arg_messages = []
    for message in messages:
        if message.role not in ["system", "instruction"]:
            content_blocks = []
            for c in message.content:
                if c.content_type == "text":
                    content_blocks.append({"text": c.body})
                elif c.content_type == "image":
                    # e.g. "image/png" -> "png"
                    format = c.media_type.split("/")[1]
                    content_blocks.append(
                        {
                            "image": {
                                "format": format,
                                # decode base64 encoded image
                                "source": {"bytes": base64.b64decode(c.body)},
                            }
                        }
                    )
                elif c.content_type == "attachment":
                    content_blocks.append(
                        {
                            "document": {
                                "format": _get_converse_supported_format(
                                    Path(c.file_name).suffix[
                                        1:
                                    ],  # e.g. "document.txt" -> "txt"
                                ),
                                "name": Path(
                                    _convert_to_valid_file_name(c.file_name)
                                ).stem,  # e.g. "document.txt" -> "document"
                                # encode text attachment body
                                "source": {"bytes": base64.b64decode(c.body)},
                            }
                        }
                    )
                else:
                    raise NotImplementedError()
            arg_messages.append({"role": message.role, "content": content_blocks})

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

    # `top_k` is configured in `additional_model_request_fields` instead of `inference_config`
    additional_model_request_fields = {"top_k": inference_config["top_k"]}
    del inference_config["top_k"]

    args: ConverseApiRequest = {
        "inference_config": convert_dict_keys_to_camel_case(inference_config),
        "additional_model_request_fields": additional_model_request_fields,
        "model_id": get_model_id(model),
        "messages": arg_messages,
        "stream": stream,
        "system": [],
    }
    if instruction:
        args["system"].append({"text": instruction})
    return args


def call_converse_api(args: ConverseApiRequest) -> ConverseApiResponse:
    client = get_bedrock_client()
    messages = args["messages"]
    inference_config = args["inference_config"]
    additional_model_request_fields = args["additional_model_request_fields"]
    model_id = args["model_id"]
    system = args["system"]

    response = client.converse(
        modelId=model_id,
        messages=messages,
        inferenceConfig=inference_config,
        system=system,
        additionalModelRequestFields=additional_model_request_fields,
    )

    return response


def calculate_price(
    model: type_model_name,
    input_tokens: int,
    output_tokens: int,
    region: str = BEDROCK_REGION,
) -> float:
    input_price = (
        BEDROCK_PRICING.get(region, {})
        .get(model, {})
        .get("input", BEDROCK_PRICING["default"][model]["input"])
    )
    output_price = (
        BEDROCK_PRICING.get(region, {})
        .get(model, {})
        .get("output", BEDROCK_PRICING["default"][model]["output"])
    )

    return input_price * input_tokens / 1000.0 + output_price * output_tokens / 1000.0


def get_model_id(model: type_model_name) -> str:
    # Ref: https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
    if model == "claude-v2":
        return "anthropic.claude-v2:1"
    elif model == "claude-instant-v1":
        return "anthropic.claude-instant-v1"
    elif model == "claude-v3-sonnet":
        return "anthropic.claude-3-sonnet-20240229-v1:0"
    elif model == "claude-v3-haiku":
        return "anthropic.claude-3-haiku-20240307-v1:0"
    elif model == "claude-v3-opus":
        return "anthropic.claude-3-opus-20240229-v1:0"
    elif model == "claude-v3.5-sonnet":
        return "anthropic.claude-3-5-sonnet-20240620-v1:0"

# 가드레일 리스트 조회
def get_guardrail_list():
    client = get_aws_bedrock_client()
    try:
        response = client.list_guardrails()
        return response.get('guardrails', [])
    except Exception as e:
        print(f"Error fetching guardrail list: {e}")
        return []

# 가드레일 상세정보 조회
def get_guardrail_detail_info(id):
    client = get_aws_bedrock_client()
    try:
        response = client.get_guardrail(guardrailIdentifier=id)
        return response
    except Exception as e:
        print(f"Error fetching guardrail detail: {e}")
        return {}

# 프롬프트 리스트 조회 함수
def get_prompt_list():
    client = get_aws_bedrock_agent_client()
    try:
        # 'list_prompts' 메서드를 사용해 프롬프트 리스트 조회
        response = client.list_prompts()

        # API 호출 결과에서 프롬프트 목록을 추출하여 반환
        return response.get('promptSummaries', [])
    
    except Exception as e:
        print(f"Error fetching prompt list: {e}")
        return []
    
# 프롬프트 상세정보 조회
def get_prompt_detail_info(id):
    client = get_aws_bedrock_agent_client()
    try:
        response = client.get_prompt(promptIdentifier=id)
        return response
    except Exception as e:
        print(f"Error fetching prompt detail: {e}")
        return {}

# 임시 dict 타입의 응답 값을 보기 좋게 출력하는 함수
def pretty_print_dict_pprint(response_dict):
    pprint.pprint(response_dict, indent=4, width=80)


# Guardrail 리스트 조회 예시
if __name__ == "__main__":
    # Guardrail 리스트 가져오기
    guardrail_list = get_guardrail_list()

    # 결과 출력
    print("Guardrail List:")
    for guardrail in guardrail_list:
        print('--------------------가드레일 요약-------------------------')
        pretty_print_dict_pprint(guardrail)
        print('--------------------가드레일 상세-------------------------')
        pretty_print_dict_pprint(get_guardrail_detail_info(guardrail['id']))

    # 프롬프트 조회
    prompt_list = get_prompt_list()

    for prompt in prompt_list:
        print('--------------------PROMPT 요약-------------------------')
        pretty_print_dict_pprint(prompt)
        print('--------------------PROMPT 상세-------------------------')
        pretty_print_dict_pprint(get_prompt_detail_info(prompt['id']))
# -*- coding: utf-8 -*-
from typing import Collection
from aws_lambda_powertools import Logger
import boto3
from botocore.config import Config
import base64
import imghdr

logger = Logger()

bedrock = boto3.client(service_name="bedrock-runtime", region_name="us-west-2",
  config=Config(
    connect_timeout=600,
    read_timeout=600,
    retries={
      "mode": "standard",
      "total_max_attempts": 3,
    }
  )
)

def run_multi_modal_prompt(model_id: str, messages, max_tokens: int):
  inference_config = {
    "temperature": 0.6
  }
  additional_model_fields = {
     "top_k": 250
  }

  response = bedrock.converse(
    modelId=model_id,
    messages=messages,
    inferenceConfig=inference_config,
    additionalModelRequestFields=additional_model_fields,
  )
  output_message = response

  return output_message

def get_bedrock_image_contents_format(base64_image: str) -> dict[str, Collection[str]] | None:

    # base64イメージのデコード
    decoded_base64_image = base64.b64decode(base64_image)
    # formatの自動判定
    format: str = imghdr.what(None, decoded_base64_image)

    allowed_formats = ["png", "jpeg"]
    if format in allowed_formats:
      return (
        {
          "image": {
            "format": format,
            "source": {
              "bytes": decoded_base64_image
            }   
          }
        }
      )
    else:
      return None

def get_model_id(model: str) -> str:
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
  elif model == "mistral-7b-instruct":
      return "mistral.mistral-7b-instruct-v0:2"
  elif model == "mixtral-8x7b-instruct":
      return "mistral.mixtral-8x7b-instruct-v0:1"
  elif model == "mistral-large":
      return "mistral.mistral-large-2402-v1:0"
  else:
      raise NotImplementedError()
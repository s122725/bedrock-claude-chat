# -*- coding: utf-8 -*-
from aws_lambda_powertools import Logger
import boto3
import json
import os
from lib.s3 import get_image_content_type
from retry import retry

logger = Logger()

RETRIES_TO_BEDROCK = 4
RETRY_DELAY_TO_BEDROCK = 2

bedrock = boto3.client(service_name="bedrock-runtime", region_name="us-west-2")

class bedrock_content_source:
  type: str
  media_type: str
  data: str
class bedrock_content:
  type: str
  source: bedrock_content_source
  
@retry(tries=RETRIES_TO_BEDROCK, delay=RETRY_DELAY_TO_BEDROCK)
def run_multi_modal_prompt(model_id: str, messages, max_tokens: int):
  body = json.dumps(
    {
      "anthropic_version": "bedrock-2023-05-31",
      "max_tokens": max_tokens,
      "messages": messages,
      "temperature": 0.1,
      "top_p": 0.999,
      "top_k": 250
    }
  )

  response = bedrock.invoke_model(
    body=body, modelId=model_id)
  response_body = json.loads(response.get('body').read())

  return response_body

def get_base64_image_for_bedrock_content(base64_image: str) -> bedrock_content:
    # コンテンツタイプの自動判定
    content_type: str = get_image_content_type(base64_image)

    return (
      {
        "type": "image",
        "source": {
          "type": "base64",
          "media_type": content_type,
          "data": base64_image
        }
      }
    )


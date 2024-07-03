# -*- coding: utf-8 -*-
import boto3
import logging
import tempfile
import os
from lib.prompt import promptTest
from lib.s3 import get_image_base64
from app.bedrock import get_model_id
from lib.bedrock import get_base64_image_for_bedrock_content, run_multi_modal_prompt

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

BEDROCK_MODEL_NAME = os.environ.get('BEDROCK_MODEL_NAME', 'claude-2-sonnet')

# S3クライアントの作成
s3 = boto3.client('s3')

def lambda_handler(event, context):
  
  logger.debug(f"event: {event}")

  # StepFunctionsからの入力値を受け取る
  bucket = event['body']['input']['bucket']
  key = event['body']['input']['key']
  user_id = event['body']['input']['user_id']
  bot_id = event['body']['input']['bot_id']
  exec_id = event['body']['input']['exec_id']
  filename = event['body']['input']['filename']
  text = event['body']['input']['text']
  enable_pdf_image_scan = event['body']['input']['enable_pdf_image_scan']
  image_object_key = event['body']['image_object_key']

  with tempfile.TemporaryDirectory() as temp_dir:
      base64_image = get_image_base64(bucket, image_object_key)
      image_contents = get_base64_image_for_bedrock_content(base64_image)
    
      prompt = promptTest.format(text)

      messages = [
        {
          "role": "user",
          "content": [
            image_contents,
            {
              "type": "text",
              "text": prompt
            },
          ],
        },
        {
          "role": "assistant",
          "content": [
            {
              "type": "text",
              "text": '\n\nAssistant:'
            },
          ],
        },
      ]

      response = run_multi_modal_prompt(
        model_id=get_model_id(BEDROCK_MODEL_NAME),
        messages=messages,
        max_tokens=4096
      )

      logger.debug(f"response: {response}") 

      # 返り値を返す
      return {
        'statusCode': 200,
        'body': response['content']['0']['text']
      }

# main
if __name__ == '__main__':
  lambda_handler(
    {
      "body": {
        # "url": "https://aws.amazon.com/jp/",
        # "url": "https://www.makuake.com/project/koshin/",
        # "url": "https://mastichai.com/",
        # "url": "https://www.okuta.com/secondhand/chuko.html"
        "url": "https://shopping.yahoo.co.jp/"
      },
      "execution_id": "arn:aws:states:xx-xxxx-1:0123456789012:execution:Workflow:00000000-1111-2222-3333-444444444444"
    }, None
  )
# -*- coding: utf-8 -*-
import boto3
import logging
import tempfile
import os
from lib.prompt import promptTest
from lib.s3 import get_image_base64, get_text_from_s3, get_text_from_s3, text_upload_to_s3
from lib.bedrock import get_base64_image_for_bedrock_content, run_multi_modal_prompt, get_model_id

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
  filename = event['body']['input']['filename']
  ocrResultObjectKey = event['body']['input']['ocrResultObjectKey']
  enable_pdf_image_scan = event['body']['input']['enable_pdf_image_scan']
  image_file_name = event['body']['image_file_name']

  with tempfile.TemporaryDirectory() as temp_dir:
      # s3 bucketにimage_object_key が存在する場合は、その内容を返す。
      # 手動でテキストを更新しても良い。
      text_object_key = f"{user_id}/{bot_id}/pdf_to_image/{filename}/text/{image_file_name.split(".")[0]}.txt"
      text_object = get_text_from_s3(bucket, text_object_key)
      logger.debug(f"text_object: {text_object}")
      if text_object != None:
        logger.debug(f"text: {text_object}")
        logger.debug(f"length of text: {len(text_object)}")

        return {
          'statusCode': 200,
          'body': {
            # "bucket": bucket,
            # "key": key,
            # "user_id": user_id,
            # "bot_id": bot_id,
            # "filename": filename,
            # "text": text_object,
            "image_file_name": image_file_name,
            "text_file_name": image_file_name.split(".")[0] + ".txt",
          }
        }
      else:
        # s3 bucketにocr済みのテキストが存在しない場合は、ClaudeでOCRする。
        ocrText = get_text_from_s3(bucket, ocrResultObjectKey)
        logger.debug(f"ocrText: {ocrText}")
        logger.debug(f"length of ocrText: {len(ocrText)}")
        
        image_object_key = f"{user_id}/{bot_id}/pdf_to_image/{filename}/image/{image_file_name}"
        base64_image = get_image_base64(bucket, image_object_key)
        image_contents = get_base64_image_for_bedrock_content(base64_image)
      
        prompt = promptTest.format(ocrText)

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

        logger.debug(f"response: {response["content"][0]['text']}")
        logger.debug(f"length of response: {len(response["content"][0]['text'])}")

        # 結果をS3に保存
        text_object_key = f"{user_id}/{bot_id}/pdf_to_image/{filename}/text/{image_file_name.split(".")[0]}.txt"
        text_upload_to_s3(bucket, response["content"][0]['text'], text_object_key)

        # 返り値を返す
        return {
          'statusCode': 200,
          'body': {
            "bucket": bucket,
            "key": key,
            "user_id": user_id,
            "bot_id": bot_id,
            "filename": filename,
            "text": response["content"][0]['text'],
            "image_file_name": image_file_name,
            "text_file_name": image_file_name.split(".")[0] + ".txt",
          }
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
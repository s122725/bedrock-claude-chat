# -*- coding: utf-8 -*-
from typing import Collection
import logging
import os
import json
from lib.prompt import prompt_ai_ocr
from lib.s3 import get_image_base64, get_text_from_s3, get_text_from_s3, text_upload_to_s3
from lib.bedrock import get_bedrock_image_contents_format, run_multi_modal_prompt, get_model_id

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

BEDROCK_MODEL_NAME = os.environ.get('BEDROCK_MODEL_NAME', 'claude-3-sonnet')

# max_tokensがなくなるまで再起的に処理をする。
def execute_ai_ocr(
    prompt: str,  # プロンプト
    image_contents: dict[str, Collection[str]] | None,  # Claude3に与える画像
    messages: list[dict] = [],   # Claude3のInputで使用するメッセージ
    responses: str = '' # Claude3のレスポンス
  ):

    # responsesが空欄の場合は、初期メッセージを入れる。
    if responses == '':
      # responses = '{\"thinking\":'
      responses = '{\"thinking\": \"私は与えられた画像を注意深く観察し、OCR結果を参考にしながら、画像に含まれるテキストを正確に読み取り、JSONフォーマットで出力します。回答のルールと禁止事項を守り、画像のページに含まれる情報のみを抽出します。\", \"ai_ocr_result\": \"'

    # メッセージが空欄の場合は、初期メッセージを入れる。
    if messages == []:
      if image_contents != None:
        messages.append(
          {
            "role": "user",
            "content": [
              {
                "text": prompt
              },
              image_contents,
            ],
          },
        )
      else:
        messages.append(
          {
            "role": "user",
            "content": [
              {
                "text": prompt
              },
            ],
          },
        )
      messages.append(
        {
          "role": "assistant",
          "content": [
            {
              "text": '<output> ' + responses
            },
          ],
        },
      )

    response = run_multi_modal_prompt(
      model_id=get_model_id(BEDROCK_MODEL_NAME),
      messages=messages,
      max_tokens=4096
    )
    logger.debug(response)
    responses += response['output']['message']['content'][0]['text']

    if response['stopReason'] == "max_tokens":
      # 1つ前の予め定義したassistantのメッセージをclaude3の回答に差し替える
      messages.pop()
      messages.append(
        {
          "role": "assistant",
          "content": [
            {
              "text": responses
            },
          ],
        },
      )
      # max_tokensがなくなるまで再起的に実行する
      return execute_ai_ocr(
        prompt=prompt,
        image_contents=image_contents,
        messages=messages,
        responses=responses
      )
    else:
      # メッセージから余分な文字列を削除する
      responses = responses.replace("\n</output>", "").replace("</output>", "").replace("\n</ai_ocr_result>", "").replace("</ai_ocr_result>", "").replace("\n", "")
      logger.debug(f"bedore json load: {responses}")
      # 文字列からJSONに変換する
      responses = json.loads(
        responses
      )
      logger.debug(f"after json load: {responses}")
      logger.info(responses["ai_ocr_result"])

    return responses


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
  image_file_name_without_extension = image_file_name.split(".")[0]

  # s3 bucketにimage_object_key が存在する場合は、その内容を返す。
  # 手動でテキストを更新しても良い。
  text_object_key = f"{user_id}/{bot_id}/pdf_to_image/{filename}/text/{image_file_name_without_extension}.txt"
  text_object = get_text_from_s3(bucket, text_object_key)
  if text_object != "":
    logger.debug(f"text_object from s3: {text_object}")
    logger.debug(f"length of text: {len(text_object)}")

    return {
      'statusCode': 200,
      'body': {
        "image_file_name": image_file_name,
        "text_file_name": image_file_name.split(".")[0] + ".txt",
      }
    }
  else:
    # s3 bucketにocr済みのテキストが存在しない場合は、ClaudeでOCRする。
    ocr_text = get_text_from_s3(bucket, ocrResultObjectKey)
    logger.debug(f"ocr_text from unstructured: {ocr_text}")
    logger.debug(f"length of ocr_text: {len(ocr_text)}")
    
    image_object_key = f"{user_id}/{bot_id}/pdf_to_image/{filename}/image/{image_file_name}"
    logger.debug(f"image_object_key: {image_object_key}")
    base64_image = get_image_base64(bucket, image_object_key)
    image_contents = get_bedrock_image_contents_format(base64_image)
  
    # image_file_name からページ番号を抽出
    page_number = int(image_file_name.split("page")[1].split(".")[0])
    # プロンプトを組み立てる
    prompt = prompt_ai_ocr.format(ocr_text, page_number)
    # logger.debug(f"prompt: {prompt}")

    # AI-OCRを実行
    responses = execute_ai_ocr(
      prompt=prompt,
      image_contents=image_contents,
      messages=[],
      responses=''
    )
    
    # 結果をS3に保存
    text_object_key = f"{user_id}/{bot_id}/pdf_to_image/{filename}/text/{image_file_name_without_extension}.txt"
    text_upload_to_s3(bucket, responses["ai_ocr_result"], text_object_key)

    output = {
      'statusCode': 200,
      'body': {
        "bucket": bucket,
        "key": key,
        "user_id": user_id,
        "bot_id": bot_id,
        "filename": filename,
        "image_file_name": image_file_name,
        "text_file_name": image_file_name.split(".")[0] + ".txt",
      }
    }
    logger.debug(f"output: {output}")

    return output

# main
if __name__ == '__main__':
  lambda_handler(
    {
      "body": {
        "input": {
          "bucket": "bedrockchatstack-documentbucketae41e5a9-n15bauts8swr",
          "key": "f811a3b0-5061-70c0-394a-138833d4fb59/01J2AREAD7A9X17GZG9X35ETG2/documents/子育てサポートサービス金利優遇手続きのご案内.pdf",
          "user_id": "f811a3b0-5061-70c0-394a-138833d4fb59",
          "bot_id": "01J2AREAD7A9X17GZG9X35ETG2",
          "exec_id": "838605f6215341ad8e6fb7e352d40fe5",
          "filename": "子育てサポートサービス金利優遇手続きのご案内.pdf",
          "ocrResultObjectKey": "f811a3b0-5061-70c0-394a-138833d4fb59/01J2AREAD7A9X17GZG9X35ETG2/pdf_to_image/子育てサポートサービス金利優遇手続きのご案内.pdf/text/ocrText.txt",
          "mode": "pdf",
          "enable_partition_pdf": True,
          "enable_pdf_image_scan": True,
          "resultStatusUpdateRunning": {
            "SdkHttpMetadata": {
              "AllHttpHeaders": {
                "Server": [
                  "Server"
                ],
                "Connection": [
                  "keep-alive"
                ],
                "x-amzn-RequestId": [
                  "BEE41SNOF1141PTBPKOH8GHK5VVV4KQNSO5AEMVJF66Q9ASUAAJG"
                ],
                "x-amz-crc32": [
                  "2745614147"
                ],
                "Content-Length": [
                  "2"
                ],
                "Date": [
                  "Tue, 16 Jul 2024 05:36:45 GMT"
                ],
                "Content-Type": [
                  "application/x-amz-json-1.0"
                ]
              },
              "HttpHeaders": {
                "Connection": "keep-alive",
                "Content-Length": "2",
                "Content-Type": "application/x-amz-json-1.0",
                "Date": "Tue, 16 Jul 2024 05:36:45 GMT",
                "Server": "Server",
                "x-amz-crc32": "2745614147",
                "x-amzn-RequestId": "BEE41SNOF1141PTBPKOH8GHK5VVV4KQNSO5AEMVJF66Q9ASUAAJG"
              },
              "HttpStatusCode": 200
            },
            "SdkResponseMetadata": {
              "RequestId": "BEE41SNOF1141PTBPKOH8GHK5VVV4KQNSO5AEMVJF66Q9ASUAAJG"
            }
          },
          "resultTask1": {
            "ExecutedVersion": "$LATEST",
            "Payload": {
              "statusCode": 200,
              "body": {
                "image_file_names": [
                  "page0.png",
                  "page1.png"
                ]
              }
            },
            "SdkHttpMetadata": {
              "AllHttpHeaders": {
                "X-Amz-Executed-Version": [
                  "$LATEST"
                ],
                "x-amzn-Remapped-Content-Length": [
                  "0"
                ],
                "Connection": [
                  "keep-alive"
                ],
                "x-amzn-RequestId": [
                  "ba489edd-eedd-4002-85ac-47874089f6d9"
                ],
                "Content-Length": [
                  "77"
                ],
                "Date": [
                  "Tue, 16 Jul 2024 05:36:45 GMT"
                ],
                "X-Amzn-Trace-Id": [
                  "root=1-669606ed-9a0a5855ce6de4ebc6dd9c01;parent=0a70f6c0aab04c48;sampled=1;lineage=442f60e2:0"
                ],
                "Content-Type": [
                  "application/json"
                ]
              },
              "HttpHeaders": {
                "Connection": "keep-alive",
                "Content-Length": "77",
                "Content-Type": "application/json",
                "Date": "Tue, 16 Jul 2024 05:36:45 GMT",
                "X-Amz-Executed-Version": "$LATEST",
                "x-amzn-Remapped-Content-Length": "0",
                "x-amzn-RequestId": "ba489edd-eedd-4002-85ac-47874089f6d9",
                "X-Amzn-Trace-Id": "root=1-669606ed-9a0a5855ce6de4ebc6dd9c01;parent=0a70f6c0aab04c48;sampled=1;lineage=442f60e2:0"
              },
              "HttpStatusCode": 200
            },
            "SdkResponseMetadata": {
              "RequestId": "ba489edd-eedd-4002-85ac-47874089f6d9"
            },
            "StatusCode": 200
          }
        },
        "image_file_name": "page1.png"
      },
    }, None
  )
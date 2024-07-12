# -*- coding: utf-8 -*-
import base64
import boto3
import logging
import tempfile
import os
from pdf2image import convert_from_path

from lib.s3 import base64_image_upload_to_s3, check_s3_folder_and_list_files

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# S3クライアントの作成
s3 = boto3.client('s3')

def _pdf_to_images(pdf_path, output_folder):
  # PDFの各ページを画像に変換
  pages = convert_from_path(pdf_path, 300)  # 8000pxがbedrockの最大値. 6500で3.8MB未満
  
  # 出力フォルダが存在しない場合は作成
  if not os.path.exists(output_folder):
      os.makedirs(output_folder)
  
  # 各ページを個別の画像として保存
  image_paths = []
  for i, page in enumerate(pages):
      image_name = f'page_{i}.png'
      image_path = os.path.join(output_folder, image_name)
      page.save(image_path, 'PNG')
      logger.info(f'Saved: {image_path}')
      # image_paths.append(f"dummy/{image_name}")
      image_paths.append(image_path)

      # todo: S3へアップロード部分
      # result = image_upload_to_s3(image_path, BUCKET_NAME, f"dummy/{image_name}")
  return image_paths


# s3 upload image

def lambda_handler(event, context):
  
  logger.debug(f"event: {event}")

  # StepFunctionsからの入力値を受け取る
  bucket = event['body']['bucket']
  key = event['body']['key']
  user_id = event['body']['user_id']
  bot_id = event['body']['bot_id']
  filename = event['body']['filename']
  enable_pdf_image_scan = event['body']['enable_pdf_image_scan']

  with tempfile.TemporaryDirectory() as temp_dir:
    file_path = f"{temp_dir}/{key}"
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    s3.download_file(bucket, key, file_path)
    extension = os.path.splitext(file_path)[1]

    logger.debug(f"file_path: {file_path}")

    if extension == ".pdf" and enable_pdf_image_scan == True:

      # すでに画像返還済みであればスキップ
      image_file_names = check_s3_folder_and_list_files(bucket, f"{user_id}/{bot_id}/pdf_to_image/{filename}/image")
      if image_file_names == None:
        
        # PDFを１ページごとに画像変換
        image_paths = _pdf_to_images(file_path, temp_dir)

        # base64形式でimage_pathsのファイルを読み取る
        image_file_names = []
        for page_num, image_path in enumerate(image_paths):
          with open(image_path, "rb") as image_file:
            # 画像ファイルの内容を読み込む
            image_data = image_file.read()
            # 画像データをBase64エンコードする
            base64_encoded_data = base64.b64encode(image_data)

            # 画像に変換したPDFをS3にアップロードする
            object_key = f"{user_id}/{bot_id}/pdf_to_image/{filename}/image/page{page_num}.png"
            base64_image_upload_to_s3(
              bucket=bucket,
              object_key=object_key,
              base64_img=base64_encoded_data,
            )
            image_file_names.append(f"page{page_num}.png")

        return {
          'statusCode': 200,
          'body': {
            'image_file_names': image_file_names,
          }
        }
      else:
        return {
          'statusCode': 200,
          'body': {
            'image_file_names': image_file_names,
          }
        }

    else:
      return {
        'statusCode': 200,
        'body': {}
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
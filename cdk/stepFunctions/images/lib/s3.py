# -*- coding: utf-8 -*-
from aws_lambda_powertools import Logger
import base64
import boto3
import os
import imghdr
from typing import Union

logger = Logger()

# S3クライアントの作成
s3 = boto3.client('s3')

# 画像データからcontent_typeを取得する
def get_image_content_type(base64_image_data: str) -> Union[str, None]:
  # base64データをデコードしてバイナリデータに変換
  binary_data = base64.b64decode(base64_image_data)

  # imghdrモジュールを使って画像タイプを判定
  image_type = imghdr.what(None, binary_data)

  # 画像タイプに応じてcontent_typeを返す
  if image_type == 'jpeg':
    return 'image/jpeg'
  elif image_type == 'png':
    return 'image/png'
  elif image_type == 'gif':
    return 'image/gif'
  elif image_type == 'bmp':
    return 'image/bmp'
  else:
    return None


def get_image_base64(bucket: str, key: str) -> str:
  response = s3.get_object(Bucket=bucket, Key=key)
  image_data = response['Body'].read()
  return base64.b64encode(image_data).decode('utf-8')

# s3からテキストファイルを取得
def get_text_from_s3(bucket: str, keys: list[str]) -> list[str]:
  texts: list = []
  for key in keys:
    response = s3.get_object(Bucket=bucket, Key=key)
    text = response['Body'].read().decode('utf-8')
    texts.append(text)
  return texts

# ローカルの画像ファイルをs3にpush
def local_image_upload_to_s3(filepath: str, bucket: str, filename: str):
  logger.info(f"{filepath}, {bucket}, {filename}")
  return s3.upload_file(filepath, bucket, filename)

# base64の画像をs3にpush
def base64_image_upload_to_s3(bucket: str, object_key: str, base64_img: base64):

  # コンテンツタイプの自動判定
  content_type = get_image_content_type(base64_img)

  if content_type is not None:
    return s3.put_object(
      Bucket=bucket,
      Key=object_key,
      Body=base64.b64decode(base64_img),
      ContentType=content_type
    )
  else:
    return None
  
# HPのテキストをs3にpush
def text_upload_to_s3(bucket: str, body, object_key: str):
  s3.put_object(
    Bucket=bucket,
    Key=object_key,
    Body=body,
    ContentType='text/plain'
  )
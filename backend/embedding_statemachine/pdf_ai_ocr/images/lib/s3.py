# -*- coding: utf-8 -*-
from aws_lambda_powertools import Logger
import base64
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config
import imghdr
from typing import Union

logger = Logger()

# S3クライアントの作成
s3_client = boto3.client('s3',
  config=Config(
    connect_timeout=600,
    read_timeout=600,
    retries={
        "mode": "standard",
        "total_max_attempts": 3,
    }
  )
)

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
  response = s3_client.get_object(Bucket=bucket, Key=key)
  image_data = response['Body'].read()
  return base64.b64encode(image_data).decode('utf-8')

# s3からテキストファイルを取得
def get_text_from_s3(bucket: str, key: str) -> str:
  try:
    response = s3_client.get_object(Bucket=bucket, Key=key)
    text = response['Body'].read().decode('utf-8')
    return text

  except ClientError as e:
    error_code = e.response['Error']['Code']
    if error_code == 'NoSuchKey':
        logger.debug("指定したキーは存在しません。")
        return ""
    else:
        raise

# S3バケット内の指定したファイルの存在を確認する関数
def check_s3_folder_and_list_files(bucket_name, folder_path) -> None | list:
    """
    Check if a folder exists in an S3 bucket and list its contents if it does.
    
    Args:
    bucket_name (str): Name of the S3 bucket
    folder_path (str): Path of the folder to check (should end with '/')
    
    Returns:
    list: List of file names in the folder if it exists, None otherwise
    """
    
    # Ensure folder_path ends with '/'
    if not folder_path.endswith('/'):
        folder_path += '/'
    
    try:
        # List objects in the specified folder
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=folder_path,
            Delimiter='/'
        )
        
        # Check if the folder exists
        if 'Contents' in response or 'CommonPrefixes' in response:
            files = []
            
            # Get files directly in the folder
            if 'Contents' in response:
                files.extend([obj['Key'].split('/')[-1] for obj in response['Contents'] 
                              if obj['Key'] != folder_path])
            
            # Get subfolders
            if 'CommonPrefixes' in response:
                files.extend([prefix['Prefix'].split('/')[-2] + '/' 
                              for prefix in response['CommonPrefixes']])
            
            return files
        else:
            logger.debug(f"Folder '{folder_path}' does not exist in bucket '{bucket_name}'")
            return None
    
    except ClientError as e:
        logger.debug(f"An error occurred: {e}")
        return None

# ローカルの画像ファイルをs3にpush
def local_image_upload_to_s3(filepath: str, bucket: str, filename: str):
  logger.info(f"{filepath}, {bucket}, {filename}")
  return s3_client.upload_file(filepath, bucket, filename)

# base64の画像をs3にpush
def base64_image_upload_to_s3(bucket: str, object_key: str, base64_img: str):

  # コンテンツタイプの自動判定
  content_type = get_image_content_type(base64_img)

  if content_type is not None:
    return s3_client.put_object(
      Bucket=bucket,
      Key=object_key,
      Body=base64.b64decode(base64_img),
      ContentType=content_type
    )
  else:
    return None
  
# HPのテキストをs3にpush
def text_upload_to_s3(bucket: str, body, object_key: str):
  s3_client.put_object(
    Bucket=bucket,
    Key=object_key,
    Body=body,
    ContentType='text/plain'
  )

def download_file(bucket: str, key: str, local_path: str):
  s3_client.download_file(bucket, key, local_path)
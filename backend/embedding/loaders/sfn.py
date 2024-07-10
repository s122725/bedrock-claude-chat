import os
import tempfile
import logging
import boto3
import botocore
import time
import json
from distutils.util import strtobool
from embedding.loaders.base import BaseLoader, Document
from unstructured.partition.auto import partition
from unstructured.partition.pdf import partition_pdf
from pdf2image import convert_from_path
import string
import random

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Statemachineのarn
STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]

class StepFunctionsLoader(BaseLoader):
    """Loads a document from a file in S3.
    Reference: `langchain_community.document_loaders.S3FileLoader` class
    """

    def __init__(
        self,
        bucket: str,
        key: str,
        user_id: str,
        bot_id: str,
        exec_id: str,
        filename: str,
        enable_partition_pdf: bool = False,
        enable_pdf_image_scan: bool = False
    ):
        self.bucket = bucket
        self.key = key
        self.user_id = user_id
        self.bot_id = bot_id
        self.exec_id = exec_id
        self.filename = filename
        self.enable_partition_pdf = enable_partition_pdf
        self.enable_pdf_image_scan = enable_pdf_image_scan

    def _get_elements(self) -> list:
        """Get elements."""
        s3 = boto3.client("s3")
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = f"{temp_dir}/{self.key}"
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            s3.download_file(self.bucket, self.key, file_path)
            extension = os.path.splitext(file_path)[1]

            if extension == ".pdf" and (self.enable_partition_pdf == True):
                logger.info(f"Start partitioning using hi-resolution mode: {file_path}")
                return partition_pdf(
                    filename=file_path,
                    strategy="hi_res",
                    infer_table_structure=True,
                    extract_images_in_pdf=False,
                )
            else:
                logger.info(f"Start partitioning using auto mode: {file_path}")
                return partition(filename=file_path)

    def _pdf_to_images(self, pdf_path: str, output_folder: str) -> list[str]:
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

    def _wait_sfn_execution(self, execution_arn: str, timeout: int = 300) -> dict:
        """Wait for StepFunctions execution to complete."""
        sfn = boto3.client('stepfunctions')
        start_time = time.time()
        logger.info(f"execution_arn: {execution_arn}")
        logger.info(f"type(execution_arn): {type(execution_arn)}")
        while True:
            response = sfn.describe_execution(executionArn=execution_arn)
            logger.info(f"response: {response}")
            status = response['status']
            if status == 'RUNNING':
                if time.time() - start_time > timeout:
                    raise TimeoutError(f"StepFunctions execution timed out after {timeout} seconds")
                time.sleep(5)
            elif status == 'SUCCEEDED':
                logger.info("sfn execution was SUCCEEDED")
                return response
            else:
                logger.info("sfn execution was undefined status")
                return response

    # s3からテキストファイルを取得
    def _get_text_from_s3(self, bucket: str, key: str) -> str:
        try:
            s3 = boto3.client('s3')
            response = s3.get_object(Bucket=bucket, Key=key)
            text = response['Body'].read().decode('utf-8')
            return text

        except botocore.exceptions.ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'NoSuchKey':
                print("指定したキーは存在しません。")
                return None
            else:
                raise

    def text_upload_to_s3(self, bucket: str, body, object_key: str):
        s3 = boto3.client('s3')
        s3.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=body,
            ContentType='text/plain'
        )

    def load(self) -> list[Document]:
        """Load file."""

        # PDFからテキストを抽出
        elements = self._get_elements()
        ocrText = "\n\n".join([str(el) for el in elements])
        logger.info(f"ocrText: {ocrText}")

        # PDFから抽出したテキストをS3にアップロード
        ocrResultObjectKey = f"{self.user_id}/{self.bot_id}/pdf_to_image/{self.filename}/text/ocrText.txt"
        logger.info(f"ocrResultObjectKey: {ocrResultObjectKey}")
        self.text_upload_to_s3(self.bucket, ocrText, ocrResultObjectKey)

        # StepFunctionsを同期で実行
        sfn = boto3.client('stepfunctions')

        # ランダムな文字列を五文字分
        suffix = ''.join(random.choices(string.ascii_letters + string.digits, k=5))

        sfn_response = sfn.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            name=f"pdf_aiocr_{self.filename}_{suffix}", # 重複禁止。デバッグしやすいようにわかりやすい名前をつける。
            input=json.dumps({
                "bucket": self.bucket,
                "key": self.key,
                "user_id": self.user_id,
                "bot_id": self.bot_id,
                "exec_id": self.exec_id,
                "filename": self.filename,
                "ocrResultObjectKey": ocrResultObjectKey,
                "mode": "pdf",
                "enable_partition_pdf": self.enable_partition_pdf,
                "enable_pdf_image_scan": self.enable_pdf_image_scan,
            })
        )
        # 実行ARNを取得
        logger.info(f"sfn_response: {sfn_response}")
        # ステートマシンの終了を待つ。
        sfn_exec_result = self._wait_sfn_execution(sfn_response.get('executionArn'))
        # 実行結果から出力を取得
        logger.info(f"sfn_exec_result: {sfn_exec_result}")

        # S3から結果を結果を取得する
        output = json.loads(sfn_exec_result['output'])
        resultObjectKeyList = output['resultObjectKeyList']
        logger.info(f"resultObjectKeyList: {resultObjectKeyList}")
        docs = []
        for resultObjectKey in resultObjectKeyList:
            logger.info(f"resultObjectKey: {resultObjectKey}")
            text_file_name = resultObjectKey["text_file_name"]
            image_file_name = resultObjectKey["image_file_name"]

            resultObject = self._get_text_from_s3(self.bucket, f"{self.user_id}/{self.bot_id}/pdf_to_image/{self.filename}/text/{text_file_name}")
            logger.info(f"resultObject: {resultObject}")

            docs.append(
                Document(
                    page_content=resultObject, 
                    metadata={
                        'metadata': { # metadataはDBのmetadataにJSON型で格納される想定
                            'parentSource': "s3://{}/{}".format(self.bucket, self.key), # オリジナルのPDFをmetadata.parentSourceにセットする. 
                        },
                        'source': "s3://{}/{}/{}/pdf_to_image/{}/image/{}".format(self.bucket, self.user_id, self.bot_id, self.filename, image_file_name), # 該当ページの画像
                    }
                )
            )
        return docs

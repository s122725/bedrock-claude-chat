import base64
import os

import requests


def get_pdf_info(url) -> tuple[str, str]:
    response = requests.get(url)

    if response.status_code == 200:
        content_disposition = response.headers.get("Content-Disposition")
        if content_disposition:
            filename = content_disposition.split("filename=")[1].strip('"')
        else:
            filename = os.path.basename(url)

        file_content_byte = response.content
        file_content = base64.b64encode(file_content_byte).decode("utf-8").strip()

        return filename, file_content
    else:
        raise Exception(f"Failed to fetch PDF from {url}")


def get_aws_overview() -> tuple[str, str]:
    URL = "https://pages.awscloud.com/rs/112-TZM-766/images/Architecting%20on%20AWS.pdf"
    return get_pdf_info(URL)

FROM public.ecr.aws/lambda/python:3.11

RUN yum -y install poppler poppler-utils

COPY ./docker/pdf_to_image/pyproject.toml ./docker/pdf_to_image/poetry.lock ./
ENV POETRY_REQUESTS_TIMEOUT=10800
RUN python -m pip install --upgrade pip && \
    pip install poetry --no-cache-dir && \
    poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --only main && \
    poetry cache clear --all pypi

COPY ../pdf_to_image.py ${LAMBDA_TASK_ROOT}
COPY ../lib ${LAMBDA_TASK_ROOT}/lib

CMD ["pdf_to_image.lambda_handler"]

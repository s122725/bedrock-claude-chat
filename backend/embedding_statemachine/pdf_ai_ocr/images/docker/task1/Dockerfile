FROM public.ecr.aws/lambda/python:3.11

RUN yum -y install poppler poppler-utils

# COPY requirements.txt  .
COPY ./docker/task1/pyproject.toml ./docker/task1/poetry.lock ./
ENV POETRY_REQUESTS_TIMEOUT=10800
RUN python -m pip install --upgrade pip && \
    pip install poetry --no-cache-dir && \
    poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --only main && \
    poetry cache clear --all pypi

COPY ../task1.py ${LAMBDA_TASK_ROOT}
COPY ../lib ${LAMBDA_TASK_ROOT}/lib

CMD ["task1.lambda_handler"]

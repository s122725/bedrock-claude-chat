FROM public.ecr.aws/lambda/python:3.11

COPY ./pyproject.toml ./poetry.lock ./

ENV POETRY_REQUESTS_TIMEOUT=600
RUN pip install poetry --no-cache-dir && \
    poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi

COPY ./app ./app
COPY ./embedding_statemachine ./embedding_statemachine

CMD ["app.websocket.handler"]
FROM public.ecr.aws/lambda/python:3.11

RUN yum -y install poppler poppler-utils

COPY requirements.txt  .
RUN  pip3 install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

COPY ../task1.py ${LAMBDA_TASK_ROOT}
COPY ../lib ${LAMBDA_TASK_ROOT}/lib

CMD ["task1.lambda_handler"]

import {
  aws_stepfunctions as sfn
} from 'aws-cdk-lib'

export const functionDefinitionParam = {
  build: false,
  // dockerileName: "docker/task1/Dockerfile",
  entry: './stepFunctions/images',
  index: 'task2.py',
  handler: "lambda_handler",
  functionName: 'task2',
  memorySize: 256,
  environment: {
    BEDROCK_MODEL_NAME: "claude-v3-sonnet"
  },
  initialPolicy: [
  ],
  retry: true,
  retryCount: 2,
  outputPath: '$.Payload.body',
  resultPath: '$',
}

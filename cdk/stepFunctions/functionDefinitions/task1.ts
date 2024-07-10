import {
  aws_stepfunctions as sfn
} from 'aws-cdk-lib'

export const functionDefinitionParam = {
  build: true,
  dockerileName: "docker/task1/Dockerfile",
  entry: './stepFunctions/images',
  index: 'task1.py',
  handler: "lambda_handler",
  functionName: 'task1',
  memorySize: 4096,
  environment: {
  },
  initialPolicy: [
  ],
  retry: true,
  retryCount: 2,
  outputPath: '$',
  resultPath: '$.resultTask1',
}

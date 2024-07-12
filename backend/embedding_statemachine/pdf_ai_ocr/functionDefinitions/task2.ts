export const functionDefinitionParam = {
  build: false,
  // dockerileName: "docker/task1/Dockerfile",
  entry: '../backend/embedding_statemachine/pdf_ai_ocr/images',
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
  retryCount: 5,
  outputPath: '$.Payload.body',
  resultPath: '$',
}

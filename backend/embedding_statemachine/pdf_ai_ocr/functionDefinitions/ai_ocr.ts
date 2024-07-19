export const functionDefinitionParam = {
  build: true,
  dockerileName: "docker/ai_ocr/Dockerfile",
  entry: '../backend/embedding_statemachine/pdf_ai_ocr/images',
  index: 'ai_ocr.py',
  handler: "lambda_handler",
  functionName: 'ai_ocr',
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

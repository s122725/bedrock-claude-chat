export const functionDefinitionParam = {
  build: true,
  dockerileName: "docker/task1/Dockerfile",
  entry: '../backend/embedding_statemachine/pdf_ai_ocr/images',
  index: 'task1.py',
  handler: "lambda_handler",
  functionName: 'task1',
  memorySize: 4096,
  environment: {
  },
  initialPolicy: [
  ],
  retry: true,
  retryCount: 5,
  outputPath: '$',
  resultPath: '$.resultTask1',
}

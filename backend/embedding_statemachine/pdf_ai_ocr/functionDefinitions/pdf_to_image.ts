export const functionDefinitionParam = {
  build: true,
  dockerileName: "docker/pdf_to_image/Dockerfile",
  entry: '../backend/embedding_statemachine/pdf_ai_ocr/images',
  index: 'pdf_to_image.py',
  handler: "lambda_handler",
  functionName: 'pdf_to_image',
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

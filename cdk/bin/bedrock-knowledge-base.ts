import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BedrockKnowledgeBaseStack } from "../lib/bedrock-knowledge-base-stack";
import {
  getEmbeddingModel,
  getChunkingStrategy,
  getAnalyzer,
} from "../lib/utils/bedrock-knowledge-base-args";

const app = new cdk.App();

const OWNER_USER_ID: string = app.node.tryGetContext("ownerUserId");
const BOT_ID: string = app.node.tryGetContext("botId");
const EMBEDDINGS_MODEL = getEmbeddingModel(
  app.node.tryGetContext("embeddingsModel")
);
const BEDROCK_CLAUDE_CHAT_DOCUMENT_BUCKET_NAME =
  cdk.Fn.importValue("DocumentBucketName");
const CHUNKING_STRATEGY = getChunkingStrategy(
  app.node.tryGetContext("chunkingStrategy")
);

const EXISTING_BUCKET_NAMES: string[] = app.node.tryGetContext(
  "existingBucketNames"
);
const MAX_TOKENS: number | undefined = app.node.tryGetContext("maxTokens")
  ? Number(app.node.tryGetContext("maxTokens"))
  : undefined;
const INSTRUCTION: string | undefined = app.node.tryGetContext("instruction");
const ANALYZER = getAnalyzer(app.node.tryGetContext("analyzer"));
const OVERLAP_PERCENTAGE: number | undefined = app.node.tryGetContext(
  "overlapPercentage"
)
  ? Number(app.node.tryGetContext("overlapPercentage"))
  : undefined;

const knowledgeBaseStack = new BedrockKnowledgeBaseStack(
  app,
  `KBStack${BOT_ID}`,
  {
    ownerUserId: OWNER_USER_ID,
    botId: BOT_ID,
    embeddingsModel: EMBEDDINGS_MODEL,
    bedrockClaudeChatDocumentBucketName:
      BEDROCK_CLAUDE_CHAT_DOCUMENT_BUCKET_NAME,
    chunkingStrategy: CHUNKING_STRATEGY,
    existingBucketNames: EXISTING_BUCKET_NAMES,
    maxTokens: MAX_TOKENS,
    instruction: INSTRUCTION,
    analyzer: ANALYZER,
    overlapPercentage: OVERLAP_PERCENTAGE,
  }
);

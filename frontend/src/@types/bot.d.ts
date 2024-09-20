import { BedrockKnowledgeBase } from '../features/knowledgeBase/types';

export type BotMeta = {
  id: string;
  title: string;
  description: string;
  createTime: Date;
  lastUsedTime: Date;
  isPinned: boolean;
  syncStatus: BotSyncStatus;
};

export type BotKnowledge = {
  filenames: string[];
  s3Urls: string[];
};

export type EmbeddingParams = {
  chunkSize: number;
  chunkOverlap: number;
  enablePartitionPdf: boolean;
};

export type BotKnowledgeDiff = {
  addedFilenames: string[];
  deletedFilenames: string[];
  unchangedFilenames: string[];
  s3Urls: string[];
};

export type BotSyncStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export type BotListItem = BotMeta & {
  available: boolean;
};

export type GenerationParams = {
  maxTokens: number;
  topK: number;
  topP: number;
  temperature: number;
  stopSequences: string[];
};

export type SearchParams = {
  maxResults: number;
};

export type BotDetails = BotMeta & {
  instruction: string;
  embeddingParams: EmbeddingParams;
  generationParams: GenerationParams;
  searchParams: SearchParams;
  knowledge: BotKnowledge;
  syncStatusReason: string;
  displayRetrievedChunks: boolean;
  bedrockKnowledgeBase: BedrockKnowledgeBase | null; // FIXME: nullable 하였으나 이제는 필수이기 때문에 null 제거 필요
};

export type BotSummary = BotMeta & {
  hasKnowledge: boolean;
  ownedAndHasBedrockKnowledgeBase: boolean;
};

export type BotFile = {
  filename: string;
  status: 'UPLOADING' | 'UPLOADED' | 'ERROR';
  errorMessage?: string;
  progress?: number;
};

export type RegisterBotRequest = {
  id: string;
  title: string;
  instruction: string;
  description?: string;
  embeddingParams?: EmbeddingParams | null;
  generationParams?: GenerationParams;
  searchParams?: SearchParams;
  knowledge?: BotKnowledge;
  displayRetrievedChunks: boolean;
  bedrockKnowledgeBase?: BedrockKnowledgeBase;
};

export type RegisterBotResponse = BotDetails;

export type UpdateBotRequest = {
  title: string;
  instruction: string;
  description?: string;
  embeddingParams?: EmbeddingParams | null;
  generationParams?: BotGenerationConfig;
  searchParams?: SearchParams;
  knowledge?: BotKnowledgeDiff;
  displayRetrievedChunks: boolean;
  bedrockKnowledgeBase?: BedrockKnowledgeBase;
};

export type UpdateBotResponse = {
  id: string;
  title: string;
  instruction: string;
  description: string;
  embeddingParams: EmbeddingParams;
  generationParams: GenerationParams;
  searchParams: SearchParams;
  knowledge?: BotKnowledge;
  displayRetrievedChunks: boolean;
  bedrockKnowledgeBase: BedrockKnowledgeBase;
};

export type UpdateBotPinnedRequest = {
  pinned: boolean;
};

export type UpdateBotPinnedResponse = null;

export type GetBotsRequest =
  | {
      kind: 'private';
      limit?: number;
    }
  | {
      kind: 'private';
      limit: number;
    }
  | {
      kind: 'private';
      pinned: boolean;
    };

export type GetBotsResponse = BotListItem[];

export type GetMyBotResponse = BotDetails;

export type GetBotSummaryResponse = BotSummary;

export type GetPublicBotResponse = BotDetails;

export type GetPresignedUrlResponse = {
  url: string;
};

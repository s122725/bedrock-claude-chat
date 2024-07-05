import {
  BedrockFoundationModel,
  ChunkingStrategy,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { Analyzer } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/opensearch-vectorindex";
import {
  CharacterFilterType,
  TokenFilterType,
  TokenizerType,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/opensearchserverless";

export const getEmbeddingModel = (
  embeddingsModel: string
): BedrockFoundationModel => {
  switch (embeddingsModel) {
    case "titan_v1":
      return BedrockFoundationModel.TITAN_EMBED_TEXT_V1;
    case "cohere_multilingual_v3":
      return BedrockFoundationModel.COHERE_EMBED_MULTILINGUAL_V3;
    default:
      throw new Error(`Unknown embeddings model: ${embeddingsModel}`);
  }
};

export const getChunkingStrategy = (
  chunkingStrategy: string
): ChunkingStrategy => {
  switch (chunkingStrategy) {
    case "default":
      return ChunkingStrategy.DEFAULT;
    case "fixed_size":
      return ChunkingStrategy.FIXED_SIZE;
    case "none":
      return ChunkingStrategy.NONE;
    default:
      throw new Error(`Unknown chunking strategy: ${chunkingStrategy}`);
  }
};

export const getAnalyzer = (analyzerContext: string): Analyzer => {
  const analyzer = JSON.parse(analyzerContext);

  const characterFilters: CharacterFilterType[] =
    analyzer.character_filters.map((filter: string) => {
      switch (filter) {
        case "icu_normalizer":
          return CharacterFilterType.ICU_NORMALIZER;
        // Add other character filters as needed
        default:
          throw new Error(`Unknown character filter: ${filter}`);
      }
    });

  const tokenizer: TokenizerType = (() => {
    switch (analyzer.tokenizer) {
      case "kuromoji_tokenizer":
        return TokenizerType.KUROMOJI_TOKENIZER;
      case "icu_tokenizer":
        return TokenizerType.ICU_TOKENIZER;
      default:
        throw new Error(`Unknown tokenizer: ${analyzer.tokenizer}`);
    }
  })();

  const tokenFilters: TokenFilterType[] = analyzer.token_filters.map(
    (filter: string) => {
      switch (filter) {
        case "kuromoji_baseform":
          return TokenFilterType.KUROMOJI_BASEFORM;
        case "kuromoji_part_of_speech":
          return TokenFilterType.KUROMOJI_PART_OF_SPEECH;
        case "kuromoji_stemmer":
          return TokenFilterType.KUROMOJI_STEMMER;
        case "cjk_width":
          return TokenFilterType.CJK_WIDTH;
        case "ja_stop":
          return TokenFilterType.JA_STOP;
        case "lowercase":
          return TokenFilterType.LOWERCASE;
        case "icu_folding":
          return TokenFilterType.ICU_FOLDING;
        default:
          throw new Error(`Unknown token filter: ${filter}`);
      }
    }
  );

  return {
    characterFilters,
    tokenizer,
    tokenFilters,
  };
};

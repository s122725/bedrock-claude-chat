import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { VectorCollection } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/opensearchserverless";
import {
  Analyzer,
  VectorIndex,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/opensearch-vectorindex";
import * as s3 from "aws-cdk-lib/aws-s3";
import {
  BedrockFoundationModel,
  ChunkingStrategy,
  S3DataSource,
} from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";
import { KnowledgeBase } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/bedrock";

interface BedrockKnowledgeBaseStackProps extends StackProps {
  readonly ownerUserId: string;
  readonly botId: string;
  readonly embeddingsModel: BedrockFoundationModel;
  readonly bedrockClaudeChatDocumentBucketName: string;
  readonly chunkingStrategy: ChunkingStrategy;
  readonly existingBucketNames: string[];
  readonly maxTokens?: number;
  readonly instruction?: string;
  readonly analyzer?: Analyzer;
  readonly overlapPercentage?: number;
}

export class BedrockKnowledgeBaseStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: BedrockKnowledgeBaseStackProps
  ) {
    super(scope, id, props);

    // If existingBucketNames is not provided, only use the bedrockClaudeChatDocumentBucket.
    // Otherwise use the existingBucketNames, but exclude the bedrockClaudeChatDocumentBucket.
    const docBuckets: s3.IBucket[] = [];
    let inclusionPrefixes: string[] | undefined;
    if (props.existingBucketNames) {
      props.existingBucketNames.forEach((bucketName) => {
        if (bucketName !== props.bedrockClaudeChatDocumentBucketName) {
          docBuckets.push(
            s3.Bucket.fromBucketName(this, bucketName, bucketName)
          );
        }
      });
    } else {
      docBuckets.push(
        s3.Bucket.fromBucketName(
          this,
          props.bedrockClaudeChatDocumentBucketName,
          props.bedrockClaudeChatDocumentBucketName
        )
      );
      inclusionPrefixes = [`${props.ownerUserId}/${props.botId}/documents/`];
    }

    const vectorCollection = new VectorCollection(this, "KBVectors");
    const vectorIndex = new VectorIndex(this, "KBIndex", {
      collection: vectorCollection,
      indexName: "bedrock-knowledge-base-default-index",
      vectorField: "bedrock-knowledge-base-default-vector",
      vectorDimensions: props.embeddingsModel.vectorDimensions!,
      mappings: [
        {
          mappingField: "AMAZON_BEDROCK_TEXT_CHUNK",
          dataType: "text",
          filterable: true,
        },
        {
          mappingField: "AMAZON_BEDROCK_METADATA",
          dataType: "text",
          filterable: false,
        },
      ],
      analyzer: props.analyzer,
    });
    const kb = new KnowledgeBase(this, "KB", {
      embeddingsModel: props.embeddingsModel,
      vectorStore: vectorCollection,
      vectorIndex: vectorIndex,
      instruction: props.instruction,
    });

    docBuckets.forEach((bucket, index) => {
      new S3DataSource(this, `DataSource${index}`, {
        bucket: bucket,
        knowledgeBase: kb,
        dataSourceName: bucket.bucketName,
        chunkingStrategy: props.chunkingStrategy,
        maxTokens: props.maxTokens,
        overlapPercentage: props.overlapPercentage,
        inclusionPrefixes,
      });
    });

    new CfnOutput(this, "KnowledgeBaseId", {
      value: kb.knowledgeBaseId,
    });
    new CfnOutput(this, "KnowledgeBaseArn", {
      value: kb.knowledgeBaseArn,
    });
    new CfnOutput(this, "OwnerUserId", {
      value: props.ownerUserId,
    });
    new CfnOutput(this, "BotId", {
      value: props.botId,
    });
  }
}

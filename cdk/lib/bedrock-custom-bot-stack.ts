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
import {
  aws_bedrock as bedrock
} from "aws-cdk-lib";


interface BedrockCustomBotStackProps extends StackProps {
  readonly ownerUserId: string;
  readonly botId: string;
  readonly embeddingsModel: BedrockFoundationModel;
  readonly bedrockClaudeChatDocumentBucketName: string;
  readonly chunkingStrategy: ChunkingStrategy;
  readonly existingS3Urls: string[];
  readonly maxTokens?: number;
  readonly instruction?: string;
  readonly analyzer?: Analyzer;
  readonly overlapPercentage?: number;
  readonly is_guardrail_enabled?: boolean;
  readonly hateThreshold?: number;
  readonly insultsThreshold?: number;
  readonly sexualThreshold?: number;
  readonly violenceThreshold?: number;
  readonly misconductThreshold?: number;
  readonly relevanceThreshold?: number;
  readonly guardrailArn?: number;
  readonly guardrailVersion?: number;
}

enum Threshold {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

function getThreshold(inputParam: number | undefined): Threshold {
  if ( inputParam === undefined) {
    return Threshold.NONE;
  }
  const threshold: { [key: number]: Threshold } = {
    0: Threshold.NONE,
    1: Threshold.LOW,
    2: Threshold.MEDIUM,
    3: Threshold.HIGH
  };Threshold

  return threshold[inputParam] || Threshold.NONE;
}


export class BedrockCustomBotStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: BedrockCustomBotStackProps
  ) {
    super(scope, id, props);

    const { docBucketsAndPrefixes } = this.setupBucketsAndPrefixes(props);

    const vectorCollection = new VectorCollection(this, "KBVectors");
    const vectorIndex = new VectorIndex(this, "KBIndex", {
      collection: vectorCollection,
      // DO NOT CHANGE THIS VALUE
      indexName: "bedrock-knowledge-base-default-index",
      // DO NOT CHANGE THIS VALUE
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

    const dataSources = docBucketsAndPrefixes.map(({ bucket, prefix }) => {
      bucket.grantRead(kb.role);
      const inclusionPrefixes = prefix === "" ? undefined : [prefix];
      return new S3DataSource(this, `DataSource${prefix}`, {
        bucket: bucket,
        knowledgeBase: kb,
        dataSourceName: bucket.bucketName,
        chunkingStrategy: props.chunkingStrategy,
        maxTokens: props.maxTokens,
        overlapPercentage: props.overlapPercentage,
        inclusionPrefixes: inclusionPrefixes,
      });
    });

    if (props.is_guardrail_enabled==true){
      const guardrail = new bedrock.CfnGuardrail(this, 'Guardrail', {
        name: props.botId,
        blockedInputMessaging: "this message is blocked",
        blockedOutputsMessaging: "this message is blocked",
        contentPolicyConfig: {
          filtersConfig: [
            {
              inputStrength: getThreshold(props.hateThreshold),
              outputStrength: getThreshold(props.hateThreshold),
              type: 'HATE',
            },
            {
              inputStrength: getThreshold(props.insultsThreshold),
              outputStrength: getThreshold(props.insultsThreshold),
              type: 'INSULTS',
            },
            {
              inputStrength: getThreshold(props.sexualThreshold),
              outputStrength: getThreshold(props.sexualThreshold),
              type: 'SEXUAL',
            },
            {
              inputStrength: getThreshold(props.violenceThreshold),
              outputStrength: getThreshold(props.violenceThreshold),
              type: 'VIOLENCE',
            },
            {
              inputStrength: getThreshold(props.misconductThreshold),
              outputStrength: getThreshold(props.misconductThreshold),
              type: 'MISCONDUCT',
            }
          ]
        }
      })

      new CfnOutput(this, "GuardrailArn", {
        value: guardrail.attrGuardrailArn
      })
      new CfnOutput(this, "GuardrailVersion", {
        value: guardrail.attrVersion
      })
    }
      

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
    dataSources.forEach((dataSource, index) => {
      new CfnOutput(this, `DataSource${index}`, {
        value: dataSource.dataSourceId,
      });
    });
  }

  private setupBucketsAndPrefixes(props: BedrockCustomBotStackProps): {
    docBucketsAndPrefixes: { bucket: s3.IBucket; prefix: string }[];
  } {
    /**
     * Setup the document buckets and prefixes based on the provided properties.
     *
     * This method processes the provided existing bucket URLs and sets up the
     * S3 buckets and inclusion prefixes accordingly. It always includes the
     * default bedrockClaudeChatDocumentBucketName in the list of document buckets.
     *
     * @param props The properties passed to the stack, including existing bucket URLs, owner user ID, and bot ID.
     * @returns An object containing the list of document buckets and extracted prefixes.
     */
    const docBucketsAndPrefixes: { bucket: s3.IBucket; prefix: string }[] = [];

    // Always add the default bucket with its default prefix
    docBucketsAndPrefixes.push({
      bucket: s3.Bucket.fromBucketName(
        this,
        props.bedrockClaudeChatDocumentBucketName,
        props.bedrockClaudeChatDocumentBucketName
      ),
      prefix: `${props.ownerUserId}/${props.botId}/documents/`,
    });

    if (props.existingS3Urls && props.existingS3Urls.length > 0) {
      props.existingS3Urls.forEach((url) => {
        const { bucketName, prefix } = this.parseS3Url(url);
        docBucketsAndPrefixes.push({
          bucket: s3.Bucket.fromBucketName(this, bucketName, bucketName),
          prefix: prefix,
        });
      });
    }

    return { docBucketsAndPrefixes };
  }

  private parseS3Url(url: string): { bucketName: string; prefix: string } {
    console.info(`Parsing S3 URL: ${url}`);
    if (!url.startsWith("s3://")) {
      throw new Error(`Invalid S3 URL format: ${url}`);
    }

    const urlParts = url.replace("s3://", "").split("/");
    if (urlParts.length < 1) {
      throw new Error(`Invalid S3 URL format: ${url}`);
    }

    const bucketName = urlParts.shift()!;
    const prefix = urlParts.join("/");
    console.info(`Parsed S3 URL: bucketName=${bucketName}, prefix=${prefix}`);
    return { bucketName, prefix };
  }
}

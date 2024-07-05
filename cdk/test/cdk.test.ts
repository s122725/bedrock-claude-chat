import * as cdk from "aws-cdk-lib";
import { BedrockChatStack } from "../lib/bedrock-chat-stack";
import { Template } from "aws-cdk-lib/assertions";
import { AwsPrototypingChecks } from "@aws-prototyping-sdk/pdk-nag";
import {
  getEmbeddingModel,
  getChunkingStrategy,
  getAnalyzer,
} from "../lib/utils/bedrock-knowledge-base-args";
import { BedrockKnowledgeBaseStack } from "../lib/bedrock-knowledge-base-stack";

describe("Bedrock Chat Stack Test", () => {
  test("Identity Provider Generation", () => {
    const app = new cdk.App();

    const domainPrefix = "test-domain";

    const hasGoogleProviderStack = new BedrockChatStack(
      app,
      "IdentityProviderGenerateStack",
      {
        bedrockRegion: "us-east-1",
        crossRegionReferences: true,
        webAclId: "",
        identityProviders: [
          {
            secretName: "MyTestSecret",
            service: "google",
          },
        ],
        userPoolDomainPrefix: domainPrefix,
        publishedApiAllowedIpV4AddressRanges: [""],
        publishedApiAllowedIpV6AddressRanges: [""],
        allowedSignUpEmailDomains: [],
        autoJoinUserGroups: [],
        rdsSchedules: {
          stop: {},
          start: {},
        },
        enableMistral: false,
        selfSignUpEnabled: true,
        embeddingContainerVcpu: 1024,
        embeddingContainerMemory: 2048,
        natgatewayCount: 2,
      }
    );
    const hasGoogleProviderTemplate = Template.fromStack(
      hasGoogleProviderStack
    );

    hasGoogleProviderTemplate.hasResourceProperties(
      "AWS::Cognito::UserPoolDomain",
      {
        Domain: domainPrefix,
      }
    );
    hasGoogleProviderTemplate.hasResourceProperties(
      "AWS::Cognito::UserPoolClient",
      {
        SupportedIdentityProviders: ["Google", "COGNITO"],
      }
    );
    hasGoogleProviderTemplate.hasResourceProperties(
      "AWS::Cognito::UserPoolIdentityProvider",
      {
        ProviderName: "Google",
        ProviderType: "Google",
      }
    );
  });

  test("Custom OIDC Provider Generation", () => {
    const app = new cdk.App();
    const domainPrefix = "test-domain";
    const hasOidcProviderStack = new BedrockChatStack(
      app,
      "OidcProviderGenerateStack",
      {
        bedrockRegion: "us-east-1",
        crossRegionReferences: true,
        webAclId: "",
        identityProviders: [
          {
            secretName: "MyOidcTestSecret",
            service: "oidc",
            serviceName: "MyOidcProvider",
          },
        ],
        userPoolDomainPrefix: domainPrefix,
        publishedApiAllowedIpV4AddressRanges: [""],
        publishedApiAllowedIpV6AddressRanges: [""],
        allowedSignUpEmailDomains: [],
        autoJoinUserGroups: [],
        rdsSchedules: {
          stop: {},
          start: {},
        },
        enableMistral: false,
        selfSignUpEnabled: true,
        embeddingContainerVcpu: 1024,
        embeddingContainerMemory: 2048,
        natgatewayCount: 2,
      }
    );
    const hasOidcProviderTemplate = Template.fromStack(hasOidcProviderStack);

    hasOidcProviderTemplate.hasResourceProperties(
      "AWS::Cognito::UserPoolDomain",
      {
        Domain: domainPrefix,
      }
    );

    hasOidcProviderTemplate.hasResourceProperties(
      "AWS::Cognito::UserPoolClient",
      {
        SupportedIdentityProviders: ["MyOidcProvider", "COGNITO"],
      }
    );
    hasOidcProviderTemplate.hasResourceProperties(
      "AWS::Cognito::UserPoolIdentityProvider",
      {
        ProviderType: "OIDC",
      }
    );
  });

  test("default stack", () => {
    const app = new cdk.App();
    // Security check
    cdk.Aspects.of(app).add(new AwsPrototypingChecks());

    const stack = new BedrockChatStack(app, "MyTestStack", {
      bedrockRegion: "us-east-1",
      crossRegionReferences: true,
      webAclId: "",
      identityProviders: [],
      userPoolDomainPrefix: "",
      publishedApiAllowedIpV4AddressRanges: [""],
      publishedApiAllowedIpV6AddressRanges: [""],
      allowedSignUpEmailDomains: [],
      autoJoinUserGroups: [],
      rdsSchedules: {
        stop: {},
        start: {},
      },
      enableMistral: false,
      selfSignUpEnabled: true,
      embeddingContainerVcpu: 1024,
      embeddingContainerMemory: 2048,
      natgatewayCount: 2,
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs("AWS::Cognito::UserPoolIdentityProvider", 0);
    // verify the stack has environment variable VITE_APP_ENABLE_MISTRAL is set to "false"
    template.hasResourceProperties("Custom::CDKNodejsBuild", {
      environment: {
        VITE_APP_ENABLE_MISTRAL: "false",
      },
    });
  });
});

describe("Scheduler Test", () => {
  test("has schedules", () => {
    const app = new cdk.App();

    const hasScheduleStack = new BedrockChatStack(app, "HasSchedulesStack", {
      bedrockRegion: "us-east-1",
      crossRegionReferences: true,
      webAclId: "",
      identityProviders: [],
      userPoolDomainPrefix: "",
      publishedApiAllowedIpV4AddressRanges: [""],
      publishedApiAllowedIpV6AddressRanges: [""],
      allowedSignUpEmailDomains: [],
      autoJoinUserGroups: [],
      rdsSchedules: {
        stop: {
          minute: "00",
          hour: "22",
          day: "*",
          month: "*",
          year: "*",
        },
        start: {
          minute: "00",
          hour: "7",
          day: "*",
          month: "*",
          year: "*",
        },
      },
      enableMistral: false,
      selfSignUpEnabled: true,
      embeddingContainerVcpu: 1024,
      embeddingContainerMemory: 2048,
      natgatewayCount: 2,
    });
    const template = Template.fromStack(hasScheduleStack);
    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "cron(00 22 * * ? *)",
    });

    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "cron(00 7 * * ? *)",
    });
  });
  test("has'nt schedules", () => {
    const app = new cdk.App();
    const defaultStack = new BedrockChatStack(app, "DefaultStack", {
      bedrockRegion: "us-east-1",
      crossRegionReferences: true,
      webAclId: "",
      identityProviders: [],
      userPoolDomainPrefix: "",
      publishedApiAllowedIpV4AddressRanges: [""],
      publishedApiAllowedIpV6AddressRanges: [""],
      allowedSignUpEmailDomains: [],
      autoJoinUserGroups: [],
      rdsSchedules: {
        stop: {},
        start: {},
      },
      enableMistral: false,
      selfSignUpEnabled: true,
      embeddingContainerVcpu: 1024,
      embeddingContainerMemory: 2048,
      natgatewayCount: 2,
    });
    const template = Template.fromStack(defaultStack);
    // The stack should have only 1 rule for exporting the data from ddb to s3
    template.resourceCountIs("AWS::Events::Rule", 1);
  });
});

describe("Bedrock Knowledge Base Stack", () => {
  test("default kb stack", () => {
    const app = new cdk.App();
    // Security check
    cdk.Aspects.of(app).add(new AwsPrototypingChecks());

    const OWNER_USER_ID: string = "test-owner-user-id";
    const BOT_ID: string = "test-bot-id";
    const EMBEDDINGS_MODEL = getEmbeddingModel("titan_v1");
    const BEDROCK_CLAUDE_CHAT_DOCUMENT_BUCKET_NAME =
      "test-document-bucket-name";
    const CHUNKING_STRATEGY = getChunkingStrategy("default");

    const EXISTING_BUCKET_NAMES: string[] = ["bucket1", "bucket2"];
    const MAX_TOKENS: number | undefined = 1024;
    const INSTRUCTION: string | undefined = "Test instruction";
    const ANALYZER = getAnalyzer(
      JSON.stringify({
        character_filters: ["icu_normalizer"],
        tokenizer: "icu_tokenizer",
        token_filters: ["lowercase", "icu_folding"],
      })
    );
    const OVERLAP_PERCENTAGE: number | undefined = 10;

    const stack = new BedrockKnowledgeBaseStack(
      app,
      "BedrockKnowledgeBaseStack",
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

    const template = Template.fromStack(stack);
    expect(template).toBeDefined();
  });
});

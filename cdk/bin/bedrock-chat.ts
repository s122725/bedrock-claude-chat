#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BedrockChatStack } from "../lib/bedrock-chat-stack";
import { TIdentityProvider } from "../lib/utils/identity-provider";

const app = new cdk.App();

const BEDROCK_REGION = app.node.tryGetContext("bedrockRegion");

const ALLOWED_SIGN_UP_EMAIL_DOMAINS: string[] = app.node.tryGetContext(
  "allowedSignUpEmailDomains"
);
const IDENTITY_PROVIDERS: TIdentityProvider[] =
  app.node.tryGetContext("identityProviders");
const USER_POOL_DOMAIN_PREFIX: string = app.node.tryGetContext(
  "userPoolDomainPrefix"
);
const AUTO_JOIN_USER_GROUPS: string[] =
  app.node.tryGetContext("autoJoinUserGroups");

const ENABLE_MISTRAL: boolean = app.node.tryGetContext("enableMistral");
const SELF_SIGN_UP_ENABLED: boolean =
  app.node.tryGetContext("selfSignUpEnabled");
const ENABLE_KB: boolean = app.node.tryGetContext(
  "useBedrockKnowledgeBaseForRag"
);

const chat = new BedrockChatStack(app, `BedrockChatStack`, {
  env: {
    region: process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
  bedrockRegion: BEDROCK_REGION,
  identityProviders: IDENTITY_PROVIDERS,
  userPoolDomainPrefix: USER_POOL_DOMAIN_PREFIX,
  allowedSignUpEmailDomains: ALLOWED_SIGN_UP_EMAIL_DOMAINS,
  autoJoinUserGroups: AUTO_JOIN_USER_GROUPS,
  enableMistral: ENABLE_MISTRAL,
  enableKB: ENABLE_KB,
  selfSignUpEnabled: SELF_SIGN_UP_ENABLED,
});
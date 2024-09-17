# Migration Guide (v1 to v2)

## TL;DR

> [!Important]
> v2 has not been released yet, **Coming Soon**.

- **For users of v1.2 or earlier**: Upgrade to v1.4 and recreate your bots using Knowledge Base (KB). After a transition period, once you confirm everything works as expected with KB, proceed with upgrading to v2.
- **For users of v1.3**: Even if you are already using KB, it is **strongly recommended** to upgrade to v1.4 and recreate your bots. If you are still using pgvector, migrate by recreating your bots using KB in v1.4.
- **For users who wish to continue using pgvector**: Upgrading to v2 is not recommended if you plan to continue using pgvector. Upgrading to v2 will remove all resources related to pgvector, and future support will no longer be available. Continue using v1 in this case.
- Note that **upgrading to v2 will result in the deletion of all Aurora-related resources.** Future updates will focus exclusively on v2, with v1 being deprecated.

## Introduction

The v2 update introduces a major change by replacing pgvector on Aurora Serverless and ECS-based embedding with [Amazon Bedrock Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html). This change is not backward compatible. If you wish to continue using pgvector, it is recommended not to upgrade to v2 (v1 will eventually be deprecated). If you plan to upgrade, first update to v1.4 and modify the following in `cdk.json` to enable the Knowledge Base option:

```json
{
  ...,
  "useBedrockKnowledgeBasesForRag": true,
  ...
}
```

![](../imgs/v1_to_v2_arch.png)

**Note**: Once Knowledge Base is enabled, your existing bots using pgvector will be switched to **read-only mode**, meaning you will no longer be able to modify them, but they can still be used.

![](../imgs/v1_to_v2_readonly_bot.png)

### Re-create Bots

After enabling Knowledge Bases, you will need to **re-create your bots** using the same definitions as the ones that used pgvector, but now utilizing Knowledge Bases. **Be aware that some features are NOT available on Knowledge Bases, such as web crawling and YouTube transcript support.** Also, enabling Knowledge Bases will incur charges for both Aurora and Knowledge Bases during the transition.

## Migration Process

### Steps for users of v1.2 or earlier

1. **Update to v1.4**: Fetch the latest v1.4 tag, modify `cdk.json`, and deploy. Follow these steps:

   1. Fetch the latest tag:
      ```bash
      git fetch --tags
      git checkout tags/v1.4.0
      ```
   2. Modify `cdk.json` as follows:
      ```json
      {
        ...,
        "useBedrockKnowledgeBasesForRag": true,
        ...
      }
      ```
   3. Deploy the changes:
      ```bash
      cdk deploy
      ```

2. **Recreate your bots**: Recreate the bots that were using pgvector with the same definitions but now using Knowledge Base.

3. **Upgrade to v2**: After the release of v2, fetch the tagged source and deploy as follows (this will be possible once released):
   ```bash
   git fetch --tags
   git checkout tags/v2.0.0
   cdk deploy
   ```

### Steps for users of v1.3

> [!Warning]
> After updating to v1.4, the bots created under v1.3 will NOT be usable.

1. **Update to v1.4**: Follow these steps to update to v1.4:

   1. Fetch the latest v1.4 tag:
      ```bash
      git fetch --tags
      git checkout tags/v1.4.0
      ```
   2. Modify `cdk.json` as follows:
      ```json
      {
        ...,
        "useBedrockKnowledgeBasesForRag": true,
        ...
      }
      ```
   3. Deploy the changes:
      ```bash
      cdk deploy
      ```

2. **Recreate your bots**: It is **strongly recommended** to recreate your bots in v1.4. This is because v1.4 introduces **Bedrock GuardRails** and **region changes**. For GuardRails and converse API to work properly, they must be in the same region. Additionally, Knowledge Base can only reference S3 buckets in the same region. Recreating your bots in v1.4 ensures compatibility with these new features.

3. **Upgrade to v2**: After the release of v2, fetch the tagged source and deploy as follows:
   ```bash
   git fetch --tags
   git checkout tags/v2.0.0
   cdk deploy
   ```

### Important Note

Migration of existing vector data from Aurora to the new Knowledge Bases is complex and not supported by this sample. If you rely on pgvector, consider staying with v1.

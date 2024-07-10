import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { Aws } from "aws-cdk-lib";

export interface StartIngestionJobProps extends sfn.TaskStateBaseProps {
  /**
   * The DataSource ID for the ingestion job.
   */
  readonly dataSourceId: string;
  /**
   * The KnowledgeBase ID for the ingestion job.
   */
  readonly knowledgeBaseId: string;
}

export class StartIngestionJob extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] =
    [sfn.IntegrationPattern.REQUEST_RESPONSE];

  protected readonly taskMetrics: sfn.TaskMetricsConfig | undefined;
  protected readonly taskPolicies: iam.PolicyStatement[] | undefined;
  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(
    scope: Construct,
    id: string,
    private readonly props: StartIngestionJobProps
  ) {
    super(scope, id, props);
    this.integrationPattern =
      props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    this.taskPolicies = this.renderPolicyStatements();
  }

  private renderPolicyStatements(): iam.PolicyStatement[] {
    return [
      // TODO
      new iam.PolicyStatement({
        actions: ["service:StartIngestionJob"],
        resources: ["*"],
      }),
    ];
  }

  /**
   * Provides the StartIngestionJob service integration task configuration
   *
   * @internal
   */
  protected _renderTask(): any {
    return {
      Resource: integrationResourceArn("bedrockagent", "startIngestionJob"),
      Parameters: {
        DataSourceId: this.props.dataSourceId,
        KnowledgeBaseId: this.props.knowledgeBaseId,
      },
    };
  }
}

export const resourceArnSuffix: Record<sfn.IntegrationPattern, string> = {
  [sfn.IntegrationPattern.REQUEST_RESPONSE]: "",
  [sfn.IntegrationPattern.RUN_JOB]: ".sync",
  [sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN]: ".waitForTaskToken",
};

export function integrationResourceArn(
  service: string,
  api: string,
  integrationPattern?: sfn.IntegrationPattern
): string {
  if (!service || !api) {
    throw new Error(
      "Both 'service' and 'api' must be provided to build the resource ARN."
    );
  }
  return (
    `arn:${Aws.PARTITION}:states:::aws-sdk:${service}:${api}` +
    (integrationPattern ? resourceArnSuffix[integrationPattern] : "")
  );
}

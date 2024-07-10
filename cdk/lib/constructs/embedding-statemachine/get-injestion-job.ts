import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { Aws } from "aws-cdk-lib";
import {
  resourceArnSuffix,
  integrationResourceArn,
} from "./start-injestion-job";

export interface GetIngestionJobProps extends sfn.TaskStateBaseProps {
  /**
   * The DataSource ID for the ingestion job.
   */
  readonly dataSourceId: string;
  /**
   * The KnowledgeBase ID for the ingestion job.
   */
  readonly knowledgeBaseId: string;
  /**
   * The Ingestion Job ID for the ingestion job.
   */
  readonly IngestionJobId: string;
}

export class GetIngestionJob extends sfn.TaskStateBase {
  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] =
    [sfn.IntegrationPattern.REQUEST_RESPONSE];

  protected readonly taskMetrics: sfn.TaskMetricsConfig | undefined;
  protected readonly taskPolicies: iam.PolicyStatement[] | undefined;
  private readonly integrationPattern: sfn.IntegrationPattern;

  constructor(
    scope: Construct,
    id: string,
    private readonly props: GetIngestionJobProps
  ) {
    super(scope, id, props);
    this.integrationPattern =
      props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    this.taskPolicies = this.renderPolicyStatements();
  }

  private renderPolicyStatements(): iam.PolicyStatement[] {
    return [
      new iam.PolicyStatement({
        // TODO
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
      Resource: integrationResourceArn("bedrockagent", "getIngestionJob"),
      Parameters: {
        DataSourceId: this.props.dataSourceId,
        KnowledgeBaseId: this.props.knowledgeBaseId,
        IngestionJobId: this.props.IngestionJobId,
      },
    };
  }
}

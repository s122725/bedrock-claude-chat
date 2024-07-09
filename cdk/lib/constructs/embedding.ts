import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as path from "path";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import * as cdk from "aws-cdk-lib";
import {
  DockerImageCode,
  DockerImageFunction,
  IFunction,
} from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SociIndexBuild } from "deploy-time-build";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";

export interface EmbeddingProps {
  readonly vpc: ec2.IVpc;
  readonly database: ITable;
  readonly dbSecrets: ISecret;
  readonly bedrockRegion: string;
  readonly tableAccessRole: iam.IRole;
  readonly documentBucket: IBucket;
  readonly embeddingContainerVcpu: number;
  readonly embeddingContainerMemory: number;
}

export class Embedding extends Construct {
  readonly taskSecurityGroup: ec2.ISecurityGroup;
  readonly container: ecs.ContainerDefinition;
  readonly removalHandler: IFunction;
  private _cluster: ecs.Cluster;
  private _taskDefinition: ecs.FargateTaskDefinition;
  private _pipeRole: iam.Role;
  private _stateMachine: sfn.StateMachine;
  private _taskSecurityGroup: ec2.ISecurityGroup;
  private _container: ecs.ContainerDefinition;
  private _removalHandler: IFunction;

  constructor(scope: Construct, id: string, props: EmbeddingProps) {
    super(scope, id);

    this.setupCluster(props)
      .setupEcsTaskDefinition(props)
      .createEcsContainer(props)
      .setupStateMachine(props)
      .setupEventBridgePipe(props)
      .setupRemovalHandler(props);
    this.outputValues();

    this.taskSecurityGroup = this._taskSecurityGroup;
    this.container = this._container;
    this.removalHandler = this._removalHandler;
  }

  private setupCluster(props: EmbeddingProps): this {
    this._cluster = new ecs.Cluster(this, "Cluster", {
      vpc: props.vpc,
      containerInsights: true,
    });
    return this;
  }

  private setupEcsTaskDefinition(props: EmbeddingProps): this {
    if (!this._cluster) {
      throw new Error(
        "Cluster must be initialized before setting up the task definition"
      );
    }

    this._taskSecurityGroup = new ec2.SecurityGroup(this, "TaskSecurityGroup", {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    this._taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDefinition",
      {
        cpu: props.embeddingContainerVcpu,
        memoryLimitMiB: props.embeddingContainerMemory,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      }
    );
    this._taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:*"],
        resources: ["*"],
      })
    );
    this._taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [props.tableAccessRole.roleArn],
      })
    );
    return this;
  }

  private createEcsContainer(props: EmbeddingProps): this {
    if (!this._taskDefinition) {
      throw new Error(
        "Task definition must be set up before creating the container"
      );
    }

    const taskLogGroup = new logs.LogGroup(this, "TaskLogGroup", {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const asset = new DockerImageAsset(this, "Image", {
      directory: path.join(__dirname, "../../../backend"),
      file: "embedding/Dockerfile",
      platform: Platform.LINUX_AMD64,
    });
    SociIndexBuild.fromDockerImageAsset(this, "Index", asset);

    this._container = this._taskDefinition.addContainer("Container", {
      image: ecs.AssetImage.fromDockerImageAsset(asset),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "embed-task",
        logGroup: taskLogGroup,
      }),
      environment: {
        BEDROCK_REGION: props.bedrockRegion,
        DB_SECRETS_ARN: props.dbSecrets.secretArn,
        ACCOUNT: Stack.of(this).account,
        REGION: Stack.of(this).region,
        TABLE_NAME: props.database.tableName,
        TABLE_ACCESS_ROLE_ARN: props.tableAccessRole.roleArn,
        DOCUMENT_BUCKET: props.documentBucket.bucketName,
      },
    });
    taskLogGroup.grantWrite(this._container.taskDefinition.executionRole!);
    props.dbSecrets.grantRead(this._container.taskDefinition.taskRole);
    return this;
  }

  private setupStateMachine(props: EmbeddingProps): this {
    if (!this._container) {
      throw new Error(
        "Container must be created before setting up the state machine"
      );
    }

    const ecsTask = new tasks.EcsRunTask(this, "RunEcsTask", {
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      cluster: this._cluster,
      taskDefinition: this._taskDefinition,
      launchTarget: new tasks.EcsFargateLaunchTarget(),
      containerOverrides: [
        {
          containerDefinition: this._container,
          // We use environment variables to pass the event data to the ecs task
          // instead of command because JsonPath is not supported on command
          environment: [
            {
              name: "EVENT",
              // Note that DynamoDB stream batch size is 1
              value: sfn.JsonPath.stringAt(
                "States.JsonToString($[0].dynamodb.Keys)"
              ),
            },
          ],
        },
      ],
      assignPublicIp: false,
      securityGroups: [this._taskSecurityGroup],
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    this._stateMachine = new sfn.StateMachine(this, "StateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(ecsTask),
    });
    return this;
  }

  private setupEventBridgePipe(props: EmbeddingProps): this {
    if (!this._stateMachine) {
      throw new Error(
        "State machine must be set up before setting up the EventBridge pipe"
      );
    }

    const pipeLogGroup = new logs.LogGroup(this, "PipeLogGroup", {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });
    this._pipeRole = new iam.Role(this, "PipeRole", {
      assumedBy: new iam.ServicePrincipal("pipes.amazonaws.com"),
    });
    this._pipeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams",
        ],
        resources: [props.database.tableStreamArn!],
      })
    );
    this._pipeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["states:StartExecution"],
        resources: [this._stateMachine.stateMachineArn],
      })
    );

    new CfnPipe(this, "Pipe", {
      source: props.database.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          batchSize: 1,
          startingPosition: "LATEST",
          maximumRetryAttempts: 1,
        },
        filterCriteria: {
          filters: [
            {
              pattern:
                '{"dynamodb":{"NewImage":{"SyncStatus":{"S":[{"prefix":"QUEUED"}]}}}}',
            },
          ],
        },
      },
      target: this._stateMachine.stateMachineArn,
      targetParameters: {
        stepFunctionStateMachineParameters: {
          invocationType: "FIRE_AND_FORGET",
          // input: sfn.JsonPath.stringAt("$.dynamodb.Keys"),
        },
      },
      logConfiguration: {
        cloudwatchLogsLogDestination: {
          logGroupArn: pipeLogGroup.logGroupArn,
        },
        level: "INFO",
      },
      roleArn: this._pipeRole.roleArn,
    });

    return this;
  }

  private setupRemovalHandler(props: EmbeddingProps): this {
    const removeHandlerRole = new iam.Role(this, "RemovalHandlerRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    removeHandlerRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaVPCAccessExecutionRole"
      )
    );
    removeHandlerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "cloudformation:DescribeStacks",
          "cloudformation:DescribeStackEvents",
          "cloudformation:DescribeStackResource",
          "cloudformation:DescribeStackResources",
          "cloudformation:DeleteStack",
        ],
        resources: [`*`],
      })
    );
    removeHandlerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "apigateway:GET",
          "apigateway:POST",
          "apigateway:PUT",
          "apigateway:DELETE",
        ],
        resources: [`arn:aws:apigateway:${Stack.of(this).region}::/*`],
      })
    );
    props.database.grantStreamRead(removeHandlerRole);
    props.documentBucket.grantReadWrite(removeHandlerRole);

    this._removalHandler = new DockerImageFunction(this, "BotRemovalHandler", {
      code: DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../../backend"),
        {
          platform: Platform.LINUX_AMD64,
          file: "websocket.Dockerfile",
          cmd: ["app.bot_remove.handler"],
        }
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      timeout: Duration.minutes(1),
      environment: {
        DB_SECRETS_ARN: props.dbSecrets.secretArn,
        DOCUMENT_BUCKET: props.documentBucket.bucketName,
      },
      role: removeHandlerRole,
    });
    props.dbSecrets.grantRead(this._removalHandler);
    this._removalHandler.addEventSource(
      new DynamoEventSource(props.database, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 1,
        retryAttempts: 2,
        filters: [
          {
            pattern: '{"eventName":["REMOVE"]}',
          },
        ],
      })
    );

    return this;
  }

  private outputValues(): void {
    new CfnOutput(this, "ClusterName", {
      value: this._cluster.clusterName,
    });
    new CfnOutput(this, "TaskDefinitionName", {
      value: cdk.Fn.select(
        1,
        cdk.Fn.split(
          "/",
          cdk.Fn.select(
            5,
            cdk.Fn.split(":", this._taskDefinition.taskDefinitionArn)
          )
        )
      ),
    });
    new CfnOutput(this, "TaskSecurityGroupId", {
      value: this._taskSecurityGroup.securityGroupId,
    });
  }
}

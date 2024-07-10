import {
  type StackProps, RemovalPolicy,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as sfnTasks,
  aws_iam as iam,
  aws_logs as logs,
  aws_dynamodb as dynamodb,
  aws_s3 as s3,
  Stack
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { type SfnLambdaInvoke } from '../constructs/sfn-lambda-invoke'
import { NagSuppressions } from 'cdk-nag'

interface CustomProps extends StackProps {
  sfnLambdaInvoke: SfnLambdaInvoke,
  bucket: s3.Bucket
  table: dynamodb.Table,
  tableAccessRole: iam.Role,
}

export class SfnWorkFlow extends Construct {
  public firstTask: sfnTasks.LambdaInvoke | sfnTasks.EcsRunTask | sfn.Parallel | sfn.Succeed | sfnTasks.DynamoUpdateItem
  public stateMachine: sfn.StateMachine

  constructor (scope: Construct, id: string, props: CustomProps) {
    super(scope, id)

    // StepFunctionsで使用するロールの定義
    const role = new iam.Role(this, `StepFunctionsRole`, {
      roleName: `${Stack.of(this).stackName.slice(0,5)}-StepFunctionsRole`,
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      inlinePolicies: {
        iamPass: new iam.PolicyDocument({
          statements: [
            // lambdaの実行権限を付与
            new iam.PolicyStatement({
              actions: [
                'lambda:InvokeFunction'
              ],
              resources: [
                `arn:aws:lambda:${Stack.of(this).region}:${Stack.of(this).account}:function:*`
              ]
            }),
          ]
        })
      }
    })

    // Step Functionsのログ出力の設定
    const logGroup = new logs.LogGroup(this, `StepFunctionsLogGroup`, {
      logGroupName: `StepFunctionsLogGroup`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.TWO_WEEKS // 保存期間は運用ポリシーに応じて変更すること
    })

    // dynamodbの値をRUNNINGに変更する
    const statusUpdateRunning = new sfnTasks.DynamoUpdateItem(this, 'StatusUpdateRunning', {
      table: props.table,
        key: {
          "PK": sfnTasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.user_id')),
          "SK": sfnTasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.format('{}#BOT#{}', sfn.JsonPath.stringAt('$.user_id'), sfn.JsonPath.stringAt('$.bot_id'))
          ),
        },
        updateExpression: "SET SyncStatus = :sync_status, SyncStatusReason = :sync_status_reason, LastExecId = :exec_id",
        expressionAttributeValues: {
          ":sync_status": sfnTasks.DynamoAttributeValue.fromString("RUNNING"),
          ":sync_status_reason": sfnTasks.DynamoAttributeValue.fromString(""),
          ":exec_id": sfnTasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.exec_id')),
        },
        resultPath: sfn.JsonPath.stringAt('$.resultStatusUpdateRunning'),
        outputPath: sfn.JsonPath.stringAt('$'),
      }
    )

    // dynamodbの値をSUCCEEDEDに変更する
    const statusUpdateSucceeded = new sfnTasks.DynamoUpdateItem(this, 'StatusUpdateSucceeded', {
      table: props.table,
        key: {
          "PK": sfnTasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.[0].user_id')),
          "SK": sfnTasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.format('{}#BOT#{}', sfn.JsonPath.stringAt('$.[0].user_id'), sfn.JsonPath.stringAt('$.[0].bot_id'))
          ),
        },
        updateExpression: "SET SyncStatus = :sync_status, SyncStatusReason = :sync_status_reason, LastExecId = :exec_id",
        expressionAttributeValues: {
          ":sync_status": sfnTasks.DynamoAttributeValue.fromString("SUCCEEDED"),
          ":sync_status_reason": sfnTasks.DynamoAttributeValue.fromString(""),
          ":exec_id": sfnTasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.[0].exec_id')),
        },
        resultPath: sfn.JsonPath.stringAt('$'),
        outputPath: sfn.JsonPath.stringAt('$'),
      }
    )

    // urlLoader, s3Loaderなど、用途別に処理を分岐する
    const parallel = new sfn.Parallel(this, 'Parallel', {
    })
    
    // キャプチャしたPDFの枚数だけMapで並列処理する
    const fileMap = new sfn.Map(this, 'FileMap', {
      maxConcurrency: 5,  // 並列実行数。bedrockのquotaに注意
      itemsPath: sfn.JsonPath.stringAt('$.resultTask1.Payload.body.image_file_names'),
      itemSelector: {
        "input": sfn.JsonPath.stringAt('$'),
        "image_file_name": sfn.JsonPath.stringAt('$$.Map.Item.Value'),
      }
    })
    fileMap.itemProcessor(
      props.sfnLambdaInvoke.lambdaInvoke['task2']
    )
    
    // 最後のdynamodbのステータス変更で使用するパラメータをバイパスする。
    parallel.branch(
      new sfn.Pass(this, 'Pass', {
        parameters: {
          "bucket": sfn.JsonPath.stringAt('$.bucket'),
          "key": sfn.JsonPath.stringAt('$.key'),
          "user_id": sfn.JsonPath.stringAt('$.user_id'),
          "bot_id": sfn.JsonPath.stringAt('$.bot_id'),
          "filename": sfn.JsonPath.stringAt('$.filename'),
          "exec_id": sfn.JsonPath.stringAt('$.exec_id'),
        }
      }
      )
    )
    // ユースケース毎の分岐
    parallel.branch(
      new sfn.Choice(this, 'pdf_image_scan')
        // モードがpdfの場合の処理
        .when(
          sfn.Condition.stringEquals('$.mode', 'pdf'),
          props.sfnLambdaInvoke.lambdaInvoke['task1'].next(
            fileMap
          )
        )
        // // モードがその他の場合の処理
        // .otherwise(
        //   new sfn.Succeed(this, 'Succeed')
        // )
    )

    // task2完了後に、dynamodbのステータス更新と、task2の実行結果を後続に渡すタスクに分岐する
    const parallel2 = new sfn.Parallel(this, 'Parallel2', {})
      .branch(
        new sfn.Pass(this, 'Pass2', {
          parameters: {
            "resultObjectKeyList": sfn.JsonPath.stringAt('$.[1]'),
          }
        })
      )
      .branch(
        statusUpdateSucceeded
      )
    
    // 最後の出力のフォーマットを整える
    parallel2.next(
      new sfn.Pass(this, "outputFilter", {
        parameters: {
          "resultObjectKeyList":  sfn.JsonPath.stringAt('$.[0].resultObjectKeyList'),
        }
      })
    )

    // dynamodnのステータスをrunning -> pdfから画像抽出 -> 画像からAI-OCR -> dynamodbのステータスをsucceeded
    statusUpdateRunning.next(
      parallel.next(
        parallel2
      )
    )
    
    // ワークフローの起点
    this.firstTask = statusUpdateRunning;

    this.stateMachine = new sfn.StateMachine(this, `StateMachineNode`, {
      definitionBody: sfn.DefinitionBody.fromChainable(this.firstTask),
      stateMachineName: 'EmbeddingWorkflow',
      role,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL
      },
      tracingEnabled: true
    })

    // dynamodbの読み書きを許可
    props.table.grantReadWriteData(this.stateMachine.role)

    NagSuppressions.addResourceSuppressions(this,
      [
        {
          id: 'AwsPrototyping-IAMNoManagedPolicies',
          reason: 'default policy',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ]
        },
        {
          id: 'AwsPrototyping-IAMNoWildcardPermissions',
          reason: 'default policy',
          appliesTo: [
            {
              regex: '/^Resource::arn:aws:lambda:(.*):(.*):function:*/'
            },
            'Action::s3:Abort*',
            'Action::s3:DeleteObject*',
            'Action::s3:GetBucket*',
            'Action::s3:GetObject*',
            'Action::s3:List*',
          ]
        },
      ],
      true
    )
  }
}


import {
  type StackProps, Duration,
  aws_iam as iam,
  aws_logs as logs,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_ecr_assets as assets,
  aws_stepfunctions as sfn, aws_stepfunctions_tasks as sfnTasks
} from 'aws-cdk-lib'
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha'
import * as fs from 'fs'
import path = require('path')

import { Construct } from 'constructs'
import { NagSuppressions } from 'cdk-nag'

interface CustomProps extends StackProps {
  s3Bucket: s3.Bucket
}

export class SfnLambdaInvoke extends Construct {
  public lambdaInvoke: Record<string, sfnTasks.LambdaInvoke>

  constructor (scope: Construct, id: string, props: CustomProps) {
    super(scope, id)

    interface FunctionDefinitionParam {
      build: boolean
      dockerileName: string
      entry: string
      index: string
      handler: string
      functionName: string
      memorySize: number
      environment: any
      initialPolicy: iam.PolicyStatement[]
      retry: boolean,
      retryCount: number,
      resultPath: string,
      outputPath: string
    }

    const bedrockRegion = this.node.tryGetContext("bedrockRegion")
    const lambdaLogLevel = this.node.tryGetContext("lambdaLogLevel")

    // const paramsAndSecrets = lambda.ParamsAndSecretsLayerVersion.fromVersion(
    //   lambda.ParamsAndSecretsVersions.V1_0_103,
    //   {
    //     cacheSize: 500,
    //     logLevel: lambda.ParamsAndSecretsLogLevel.DEBUG
    //   }
    // )

    const lambdaDefaultParams = {
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.minutes(15),
      tracing: lambda.Tracing.DISABLED,
      logRetention: logs.RetentionDays.ONE_MONTH,
      
    }

    const lambdaDefaultEnvironment = {
      BUCKET_NAME: props.s3Bucket.bucketName,
      BEDROCK_REGION: bedrockRegion,
      LOG_LEVEL: lambdaLogLevel,
    }
    
    // python用のlambdaInvoke作成
    const createLambdaPythonInvoke = (functionDefinitionPath: string): sfnTasks.LambdaInvoke => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const functionDefinitionFile = require(functionDefinitionPath)
      const functionDefinitionParam: FunctionDefinitionParam = functionDefinitionFile.functionDefinitionParam as FunctionDefinitionParam

      let func: lambda.DockerImageFunction | PythonFunction
      if (functionDefinitionParam.build == true){
        const dockerImage = new assets.DockerImageAsset(this, `Build-${functionDefinitionParam.functionName}`, {
            directory: `${functionDefinitionParam.entry}`,
            file: `${functionDefinitionParam.dockerileName}`,
          }
        )

        func = new lambda.DockerImageFunction(this, `Lambda-${functionDefinitionParam.functionName}`, {
          functionName: `${functionDefinitionParam.functionName}`,
          memorySize: functionDefinitionParam.memorySize,
          code: lambda.DockerImageCode.fromEcr(dockerImage.repository, {
            tagOrDigest: dockerImage.imageTag,
          }),
          environment: {
            ...lambdaDefaultEnvironment,
            ...functionDefinitionParam.environment
          },
          initialPolicy: functionDefinitionParam.initialPolicy,
          ...lambdaDefaultParams,
        })
      }else{
        func = new PythonFunction(this, `Lambda-${functionDefinitionParam.functionName}`, {
          entry: `${functionDefinitionParam.entry}`,
          index: `${functionDefinitionParam.index}`,
          handler: `${functionDefinitionParam.handler}`,
          runtime: lambda.Runtime.PYTHON_3_12,
          functionName: `${functionDefinitionParam.functionName}`,
          memorySize: functionDefinitionParam.memorySize,
          // paramsAndSecrets,
          environment: {
            ...lambdaDefaultEnvironment,
            ...functionDefinitionParam.environment
          },
          initialPolicy: functionDefinitionParam.initialPolicy,
          ...lambdaDefaultParams,
        })
      }

      const lambdaInvoke = new sfnTasks.LambdaInvoke(this, `LambdaInvoke-${functionDefinitionParam.functionName}`, {
        lambdaFunction: func,
        inputPath: sfn.JsonPath.stringAt('$'),
        payload: sfn.TaskInput.fromObject({
          'body.$': '$',
          'execution_id.$': '$$.Execution.Id'
        }),
        resultPath: functionDefinitionParam.resultPath,
        outputPath: functionDefinitionParam.outputPath
      })

      // リトライフラグが有効な場合、リトライの設定をする
      if (functionDefinitionParam.retry) addRetry(
        lambdaInvoke,
        functionDefinitionParam.retryCount,
        Duration.seconds(5),
        2
      )

      // ドキュメント保存用バケットに読み書き権限を付与
      props.s3Bucket.grantReadWrite(func)

      // grant bedrock:InvokeModel
      func.addToRolePolicy(new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`
        ]
      }))

      return lambdaInvoke
    }

    // リトライ処理の実装部分
    const addRetry = (func: sfnTasks.LambdaInvoke, maxAttempts: number = 3, interval: Duration = Duration.seconds(5), backoffRate: number = 2.0): void => {
      func.addRetry({
        interval,
        maxAttempts,
        backoffRate
      })
    }

    // /////
    // lambda/pythonフォルダに含まれるファイル名をすべて取得
    const pythonFunctionDefinitionFileNames = fs.readdirSync(path.resolve(__dirname, '../../stepFunctions/functionDefinitions'))
    // FileNamesをループする
    pythonFunctionDefinitionFileNames.forEach((functionDefinitionFilename) => {
      // 拡張子なしのファイル名
      const filenameWithoutType = functionDefinitionFilename.split('.')[0]
      // lambdaInvokeの生成
      const lambdaInvoke = createLambdaPythonInvoke(`../../stepFunctions/functionDefinitions/${functionDefinitionFilename}`)

      // ファイル名をキーに、配列にlambdaInvokeを保存
      this.lambdaInvoke = {
        ...this.lambdaInvoke,
        [`${filenameWithoutType}`]: lambdaInvoke
      }
    })

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
              regex: '/^Resource::<S3SfnResultBucket8E735001(.*).Arn>\\/*/'
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

import { CfnOutput, CustomResource, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { Connections, IConnectable, ISecurityGroup, IVpc, Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, CpuArchitecture, FargateService, FargateTaskDefinition, IService, LogDriver, OperatingSystemFamily } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancer, ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import {  INamespace, PrivateDnsNamespace } from "aws-cdk-lib/aws-servicediscovery"
import { Auth } from "./auth";

import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { Code, IFunction, Runtime, SingletonFunction } from "aws-cdk-lib/aws-lambda";


export type LangfuseProps = {
    vpc: Vpc,
    auth: Auth,
    dbSecurityGroup: ISecurityGroup,
    dbSecret: ISecret
};

const ALLOW_CIDR = "54.64.44.206/32"; // DWS Proxy IP
const HOSTED_ZONE_ID = "Z04702431OXK4NXSJF4B1";
const DOMAIN = "dlai-d.test.mmmcorp.co.jp"
const LANGFUSE_LOCAL_DOMAIN = "langfuse.local";
const LANGFUSE_HOST_NAME = "langfuse";
const LANGFUSE_PORT = 3000;
const LANGFUSE_VERSION = "2.60.1";

class CloudMapIntegration extends apigw.HttpRouteIntegration {
    private readonly cloudMapServiceArn: string;
    private readonly vpcLinkId: string;
    constructor(id: string, cloudMapServiceArn: string, vpcLinkId: string) {
      super(id);
      this.cloudMapServiceArn = cloudMapServiceArn;
      this.vpcLinkId = vpcLinkId;
    }
    public bind(_: apigw.HttpRouteIntegrationBindOptions): apigw.HttpRouteIntegrationConfig {
      return {
        type: apigw.HttpIntegrationType.HTTP_PROXY,
        connectionId: this.vpcLinkId,
        connectionType: apigw.HttpConnectionType.VPC_LINK,
        payloadFormatVersion: apigw.PayloadFormatVersion.VERSION_1_0,
        uri: this.cloudMapServiceArn,
        method: apigw.HttpMethod.ANY,
      };
    }
  }
  export interface ApiGatewayProps {
    vpc: IVpc;
    namespace: INamespace;
    allowedCidrs: string[];
  }
  class ApiGateway extends Construct implements IConnectable {
    public readonly api: apigw.HttpApi;
    public readonly url: string;
    private vpcLink: apigw.VpcLink;
    private namespace: INamespace;
    private serviceArnHandler: IFunction;
    connections: Connections;
  
    constructor(scope: Construct, id: string, props: ApiGatewayProps) {
      super(scope, id);
  
      const { vpc } = props;
  
      const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
        vpc,
      });
      const vpcLink = new apigw.VpcLink(this, 'VpcLink', {
        vpc,
        securityGroups: [securityGroup],
      });
      this.namespace = props.namespace;
      this.connections = securityGroup.connections;
  
      // The CloudMap service is created implicitly via ECS Service Connect.
      // That is why we fetch the ARN of the service via CFn custom resource.
      const handler = new SingletonFunction(this, 'GetCloudMapServiceArn', {
        runtime: Runtime.NODEJS_20_X,
        handler: 'index.handler',
        timeout: Duration.seconds(30),
        uuid: '82ebb9e7-ed95-4f5b-bd5c-584d8c1ff2ff',
        code: Code.fromInline(`
  const response = require('cfn-response');
  const sdk = require('@aws-sdk/client-servicediscovery');
  const client = new sdk.ServiceDiscoveryClient();
  
  exports.handler = async function (event, context) {
    try {
      console.log(event);
      if (event.RequestType == 'Delete') {
        return await response.send(event, context, response.SUCCESS);
      }
      // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/servicediscovery/command/ListServicesCommand/
      const namespaceId = event.ResourceProperties.NamespaceId;
      const serviceName = event.ResourceProperties.ServiceName;
      const command = new sdk.ListServicesCommand({
        Filters: [
          {
            Name: "NAMESPACE_ID",
            Values: [
              namespaceId,
            ],
            Condition: "EQ",
          },
        ],
      });
      const res = await client.send(command);
      const service = res.Services.find(service => service.Name == serviceName);
      if (service == null) {
        throw new Error('Service not found.');
      }
      await response.send(event, context, response.SUCCESS, { serviceArn: service.Arn }, service.Id);
    } catch (e) {
      console.log(e);
      await response.send(event, context, response.FAILED);
    }
  };
  `),
      });
      handler.addToRolePolicy(
        new PolicyStatement({
          actions: ['servicediscovery:ListServices'],
          resources: ['*'],
        })
      );
      this.serviceArnHandler = handler;
  
    //   const authHandler = new LlrtFunction(this, 'AuthHandler', {
    //     entry: join(__dirname, 'lambda', 'authorizer.ts'),
    //     environment: {
    //       ALLOWED_CIDRS: props.allowedCidrs.join(','),
    //     },
    //     architecture: Architecture.ARM_64,
    //   });
  
    //   // we just use authorizer for IP address restriction.
    //   const authorizer = new HttpLambdaAuthorizer('Authorizer', authHandler, {
    //     responseTypes: [HttpLambdaResponseType.IAM],
    //     identitySource: [],
    //     // must disable caching because there's no way to identify users
    //     resultsCacheTtl: Duration.seconds(0),
    //   });
  
      const api = new apigw.HttpApi(this, 'Resource', {
        apiName: 'LangfuseApiGateway',
        //defaultAuthorizer: authorizer,
      });
  
      this.api = api;
      this.vpcLink = vpcLink;
      this.url = `${api.apiEndpoint}`;
  
      new CfnOutput(this, 'ApiEndpoint', { value: api.apiEndpoint });
    }
  
    public addService(cloudMapServiceName: string, ecsService: IService, paths: string[]) {
      const serviceArn = this.getServiceArn(cloudMapServiceName, ecsService);
      paths = paths.map((path) => path.replace('*', '{proxy+}'));
  
      paths.forEach((path) =>
        this.api.addRoutes({
          path,
          methods: [apigw.HttpMethod.ANY],
          integration: new CloudMapIntegration(cloudMapServiceName, serviceArn, this.vpcLink.vpcLinkId),
        })
      );
    }
  
    private getServiceArn(serviceName: string, ecsService: IService) {
      const resource = new CustomResource(this, `GetServiceArnResult-${serviceName}`, {
        serviceToken: this.serviceArnHandler.functionArn,
        resourceType: 'Custom::GetServiceArn',
        properties: { NamespaceId: this.namespace.namespaceId, ServiceName: serviceName },
      });
      resource.node.addDependency(ecsService);
      return resource.getAttString('serviceArn');
    }
  }


export class Langfuse extends Construct {
  localUrl:string;
  secret: ISecret

  constructor(scope: Construct, id: string, props: LangfuseProps) {
    super(scope, id);


    // NOTE: LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are stored in this secret.
    //       These API keys can be obtained from the project settings in the Langfuse UI
    //       and add them in this secret via AWS Managed Console or CLI.
    const secret = new Secret(this, "LangfuseSecret", {
        secretName: "LangfuseSecret",
        secretObjectValue: {}
    });

    // ALB
    const albSg = new SecurityGroup(this, "LangfuseALBSecurityGroup", {
        vpc: props.vpc,
        description: "Security group for Langfuse ALB",
    });
    albSg.addIngressRule(Peer.ipv4(ALLOW_CIDR), Port.tcp(443), "Allow inbound HTTPS traffic");
    // Need to get immutable version because otherwise the ApplicationLoadBalancedFargateService 
    // would create 0.0.0.0/0 rule for inbound traffic
    const albSgImmutable = SecurityGroup.fromSecurityGroupId(
        this,
        "LangfuseALBSecurityGroupImmutable",
        albSg.securityGroupId,
        { mutable: false }
      );

    const alb = new ApplicationLoadBalancer(this, "LangfuseALB", {
        vpc: props.vpc,
        internetFacing: true,
        securityGroup: albSgImmutable,
    });

    // ECS
    const ecsSg = new SecurityGroup(this, "LangfuseECSSecurityGroup", {
        vpc: props.vpc,
        description: "Security group for Langfuse ECS",
    });
    ecsSg.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(LANGFUSE_PORT), "Allow inbound HTTP traffic from VPC CIDR");
    ecsSg.connections.allowFrom(albSg, Port.tcp(LANGFUSE_PORT), "Allow inbound HTTP traffic from ALB");
    props.dbSecurityGroup.connections.allowFrom(ecsSg, Port.tcp(5432), "Allow inbound PostgreSQL traffic from ECS");
    const cluster = new Cluster(this, "LangfuseCluster", {
        clusterName: "LangfuseCluster",
        vpc: props.vpc,
        containerInsights: true,
    });
    const taskRole = new Role(this, "LangfuseTaskRole", {
        assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    const execRole = new Role(this, "LangfuseExecRole", {
        assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
        managedPolicies: [ ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy") ],
    });

    const portMappingName = "langfuse2"
    const taskDef = new FargateTaskDefinition(this, "LangfuseTaskDefinition", { 
        cpu: 256,
        memoryLimitMiB: 512,
        taskRole: taskRole,
        executionRole: execRole,
        runtimePlatform: {
            cpuArchitecture: CpuArchitecture.X86_64,
            operatingSystemFamily: OperatingSystemFamily.LINUX
        },
    });
    const logGroup = new LogGroup(  this, "LangfuseLogGroup", {
        logGroupName: "/ecs/langfuse",
        removalPolicy: RemovalPolicy.DESTROY,
        retention: RetentionDays.ONE_YEAR,
    });

    const nextAuthSecret= new Secret(this, "LangfuseNextAuthSecret", {
        secretName: "LangfuseNextAuthSecret",
        generateSecretString: {
            generateStringKey: "NEXTAUTH_SECRET",
            passwordLength: 64,
            secretStringTemplate: `{
                "NEXTAUTH_SECRET": "secret"
            }`
        }
    });    
    const saltSecret= new Secret(this, "LangfuseSaltSecret", {
        secretName: "LangfuseSaltSecret",
        generateSecretString: {
            generateStringKey: "SALT",
            passwordLength: 64,
            secretStringTemplate: `{
                "SALT": "secret"
            }`
        }
    });
    const LANGFUSE_LOCAL_URL = `http://${LANGFUSE_HOST_NAME}.${LANGFUSE_LOCAL_DOMAIN}:${LANGFUSE_PORT}`

    taskDef.addContainer("LangfuseContainer", {
        image: ContainerImage.fromRegistry(`langfuse/langfuse:${LANGFUSE_VERSION}`),
        logging: LogDriver.awsLogs({
            logGroup: logGroup,
            streamPrefix: "langfuse",
        }),
        portMappings: [{ containerPort: LANGFUSE_PORT, hostPort: LANGFUSE_PORT, name: portMappingName}],
        environment: {
            DATABASE_URL: this.getDatabaseUrl(props.dbSecret),
            NEXTAUTH_SECRET: nextAuthSecret.secretValueFromJson("NEXTAUTH_SECRET").unsafeUnwrap().toString(),
            SALT: saltSecret.secretValueFromJson("SALT").unsafeUnwrap().toString(),
            NEXTAUTH_URL: `https://${LANGFUSE_HOST_NAME}.${DOMAIN}`,
            PORT: `${LANGFUSE_PORT}`,
            TELEMETRY_ENABLED: "true",
            LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES: "false",
            LANGFUSE_HOST: LANGFUSE_LOCAL_URL,
            LANGFUSE_DEFAULT_PROJECT_ROLE: "ADMIN",
        },
    });

    const namespace = new PrivateDnsNamespace(this, "LangfuseNamespace", {
        name: LANGFUSE_LOCAL_DOMAIN,
        vpc: props.vpc,
    })
    const discoveryService = namespace.createService("LangfuseService", {
        name: LANGFUSE_HOST_NAME,
    })
    const fargate = new FargateService(this, "LangfuseService", {
        cluster: cluster,
        taskDefinition: taskDef,
        desiredCount: 1,
        securityGroups: [ecsSg],
        serviceConnectConfiguration:{
            namespace: LANGFUSE_LOCAL_DOMAIN,
            services: [
                {
                    portMappingName: portMappingName
                }
            ]
        }
    });
    fargate.associateCloudMapService({
        service: discoveryService,
    })
    fargate.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 1 });

    const certificate = this.createCertificate(alb);

    alb.addListener(
        "LangfuseListener",
        {
            port: 443,
            open: true,
            certificates: [certificate],
        }
    ).addTargets(
        "LangfuseTarget",
        {
            port: LANGFUSE_PORT,
            targets: [fargate],
            protocol: ApplicationProtocol.HTTP,
            healthCheck: {
                enabled: true,
                path: "/api/public/health",
                healthyHttpCodes: "200-399",
                timeout: Duration.seconds(30),
            }
        }
    );

    // const api = new ApiGateway(this, 'ApiGateway', {
    //     vpc: props.vpc,
    //     namespace: namespace,
    //     allowedCidrs: [ALLOW_CIDR],
    // });
    // api.addService(mapping, fargate, ["/*"])
    // api.connections.allowTo(ecsSg, Port.tcp(LANGFUSE_PORT), "Allow outbound HTTP traffic to ECS");

    this.localUrl = LANGFUSE_LOCAL_URL;
    this.secret = secret;
  }

  createCertificate (alb: ApplicationLoadBalancer) {
    const hostName = `${LANGFUSE_HOST_NAME}.${DOMAIN}`
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZoneId", {hostedZoneId:HOSTED_ZONE_ID, zoneName: DOMAIN})
    const aRecord = new ARecord(this, "LangfuseARecord", {
        zone: hostedZone,
        target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
        recordName: hostName,
    });
    const certificate = new Certificate(this, "LangfuseCertificate", {
        domainName: hostName,
        validation: CertificateValidation.fromDns(hostedZone),
    });
    return certificate;
  }

  getDatabaseUrl(dbSecret: ISecret) {
    // TODO: DB password is rotated every 30 days. Need to handle this.
    const dbHost = dbSecret.secretValueFromJson("host").unsafeUnwrap().toString();
    const dbUsername = dbSecret.secretValueFromJson("username").unsafeUnwrap().toString();
    const dbPassword = dbSecret.secretValueFromJson("password").unsafeUnwrap().toString();
    const dbPort = dbSecret.secretValueFromJson("port").unsafeUnwrap().toString();
    // like postgresql://postgres:postgres@db:5432/postgres
    const DATABASE_URL = `postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/langfuse`
    return DATABASE_URL
  }

}
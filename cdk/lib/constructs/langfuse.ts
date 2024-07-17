import { Duration, RemovalPolicy, SecretValue } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { ISecurityGroup, Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, CpuArchitecture, FargateService, FargateTaskDefinition, LogDriver, OperatingSystemFamily } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancer, ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { IDatabaseCluster } from "aws-cdk-lib/aws-rds";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import {  PrivateDnsNamespace } from "aws-cdk-lib/aws-servicediscovery"
import { Auth } from "./auth";
import * as ecs from "aws-cdk-lib/aws-ecs";

export type LangfuseProps = {
    vpc: Vpc,
    auth: Auth,
    dbSecurityGroup: ISecurityGroup,
    dbSecret: ISecret
};


const ALLOW_CIDR = "0.0.0.0/32";
const HOSTED_ZONE_ID = "xxxxxxxxxxxxx";
const DOMAIN = "example.com";

const LANGFUSE_LOCAL_DOMAIN = "langfuse.local";
const LANGFUSE_HOST_NAME = "langfuse";
const LANGFUSE_PORT = 3000;
const LANGFUSE_VERSION = "2.60.1";

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
    ecsSg.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(LANGFUSE_PORT), "Allow inbound HTTP traffic from VPC CIDR")
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
        portMappings: [{ hostPort: LANGFUSE_PORT, containerPort: LANGFUSE_PORT}],
        secrets: {
            DATABASE_HOST: ecs.Secret.fromSecretsManager(props.dbSecret, "host"),
            DATABASE_USERNAME: ecs.Secret.fromSecretsManager(props.dbSecret, "username"),
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, "password"),
            NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(nextAuthSecret, "NEXTAUTH_SECRET"),
            SALT: ecs.Secret.fromSecretsManager(saltSecret, "SALT"),
        },
        environment: {
            DATABASE_NAME: "langfuse",
            NEXTAUTH_URL: `https://${LANGFUSE_HOST_NAME}.${DOMAIN}`,
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
                timeout: Duration.seconds(15),
            }
        }
    );

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
}

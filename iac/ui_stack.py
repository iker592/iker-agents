import json
from pathlib import Path

from aws_cdk import CfnOutput, Duration, RemovalPolicy, Stack
from aws_cdk import aws_apigateway as apigateway
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_deployment as s3deploy
from constructs import Construct


class UIStack(Stack):
    """CDK stack for deploying the agent management UI to AWS."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        runtime_arns: dict[str, str] | None = None,
        **kwargs,
    ) -> None:
        """
        Initialize the UI stack.

        Args:
            scope: CDK scope
            construct_id: Stack ID
            runtime_arns: Map of agent names to runtime ARNs
        """
        super().__init__(scope, construct_id, **kwargs)

        runtime_arns = runtime_arns or {}

        # Project paths
        project_root = Path(__file__).parent.parent.resolve()
        ui_path = project_root / "ui"

        # S3 bucket for hosting static UI files
        ui_bucket = s3.Bucket(
            self,
            "UIBucket",
            website_index_document="index.html",
            website_error_document="index.html",  # SPA routing
            public_read_access=True,
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=False,
                block_public_policy=False,
                ignore_public_acls=False,
                restrict_public_buckets=False,
            ),
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # Lambda function for agent invocation proxy
        agent_proxy_lambda = lambda_.Function(
            self,
            "AgentProxyLambda",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="index.handler",
            code=lambda_.Code.from_inline(
                """
import json
import boto3
import os
from typing import Any

bedrock_agent = boto3.client('bedrock-agent-runtime')

# Runtime ARNs from environment
RUNTIME_ARNS = json.loads(os.environ.get('RUNTIME_ARNS', '{}'))

def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    \"\"\"Proxy requests to Bedrock AgentCore runtimes.\"\"\"

    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Content-Type': 'application/json'
    }

    # Handle preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        path = event.get('path', '')
        method = event.get('httpMethod', 'GET')
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}

        # GET /agents - List available agents
        if path == '/agents' and method == 'GET':
            agents = []
            for name, arn in RUNTIME_ARNS.items():
                agents.append({
                    'id': name.lower().replace(' ', '-'),
                    'name': name,
                    'runtime_arn': arn,
                    'status': 'active'
                })

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'agents': agents})
            }

        # POST /invoke - Invoke an agent with AG-UI protocol support
        if path == '/invoke' and method == 'POST':
            agent_id = body.get('agent_id')
            input_text = body.get('input', '')
            session_id = body.get('session_id')
            user_id = body.get('user_id', 'default-user')
            stream_agui = body.get('stream_agui', True)  # Default to AG-UI

            if not agent_id or agent_id not in RUNTIME_ARNS:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': f'Invalid agent_id: {agent_id}',
                        'available': list(RUNTIME_ARNS.keys())
                    })
                }

            runtime_arn = RUNTIME_ARNS[agent_id]

            # Build invoke parameters
            invoke_params = {
                'agentRuntimeArn': runtime_arn,
                'input': input_text,
                'userId': user_id
            }

            if session_id:
                invoke_params['sessionId'] = session_id

            # Add AG-UI streaming hint if requested
            if stream_agui:
                invoke_params['streamingHint'] = {'type': 'AG_UI'}

            response = bedrock_agent.invoke_agent(**invoke_params)

            # Collect response chunks and events
            output = ""
            new_session_id = session_id
            events = []

            if 'completion' in response:
                for event in response['completion']:
                    # Extract session ID
                    if 'sessionId' in event:
                        new_session_id = event['sessionId']

                    # Handle chunk data
                    if 'chunk' in event:
                        chunk = event['chunk']
                        if 'bytes' in chunk:
                            chunk_data = chunk['bytes']
                            if isinstance(chunk_data, bytes):
                                chunk_text = chunk_data.decode('utf-8')
                            else:
                                chunk_text = str(chunk_data)
                            output += chunk_text

                            if stream_agui:
                                events.append({
                                    'type': 'content',
                                    'data': chunk_text
                                })

                    # Collect AG-UI protocol events
                    if stream_agui:
                        for key in ['toolUse', 'thinking', 'metadata']:
                            if key in event:
                                events.append({
                                    'type': key,
                                    'data': event[key]
                                })

            result = {
                'output': output,
                'session_id': new_session_id,
            }

            # Add AG-UI events if requested
            if stream_agui and events:
                result['events'] = events

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(result)
            }

        # Default 404
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Not found'})
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error: {error_details}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e), 'details': error_details})
        }
"""
            ),
            timeout=Duration.seconds(300),
            environment={
                "RUNTIME_ARNS": json.dumps(runtime_arns),
            },
        )

        # Grant Lambda permissions to invoke Bedrock agents
        agent_proxy_lambda.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock-agent-runtime:InvokeAgent",
                    "bedrock-agent-runtime:Retrieve",
                    "bedrock-agent-runtime:RetrieveAndGenerate",
                ],
                resources=["*"],
            )
        )

        # API Gateway for the Lambda
        api = apigateway.RestApi(
            self,
            "AgentAPI",
            rest_api_name="Agent Management API",
            description="API for managing and invoking agents",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        # Lambda integration
        lambda_integration = apigateway.LambdaIntegration(agent_proxy_lambda)

        # API routes
        agents_resource = api.root.add_resource("agents")
        agents_resource.add_method("GET", lambda_integration)

        invoke_resource = api.root.add_resource("invoke")
        invoke_resource.add_method("POST", lambda_integration)

        # CloudFront distribution
        distribution = cloudfront.Distribution(
            self,
            "UIDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(ui_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
            ],
        )

        # Deploy UI files to S3 (will be done after build)
        s3deploy.BucketDeployment(
            self,
            "DeployUI",
            sources=[s3deploy.Source.asset(str(ui_path / "dist"))],
            destination_bucket=ui_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        # Outputs
        CfnOutput(self, "UIBucketName", value=ui_bucket.bucket_name)
        CfnOutput(
            self, "UIDistributionURL", value=f"https://{distribution.domain_name}"
        )
        CfnOutput(self, "APIURL", value=api.url)
        CfnOutput(self, "APIEndpoint", value=f"{api.url}invoke")

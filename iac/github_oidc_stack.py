from aws_cdk import CfnOutput, Stack
from aws_cdk import aws_iam as iam
from constructs import Construct


class GitHubOIDCStack(Stack):
    """CDK Stack for GitHub Actions OIDC authentication."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        github_org: str = "iker592",
        github_repo: str = "iker-agents",
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Create OIDC Provider for GitHub Actions
        # Note: Only one provider per account for token.actions.githubusercontent.com
        oidc_provider = iam.OpenIdConnectProvider(
            self,
            "GitHubOIDCProvider",
            url="https://token.actions.githubusercontent.com",
            client_ids=["sts.amazonaws.com"],
        )

        # Create IAM Role that GitHub Actions can assume
        github_actions_role = iam.Role(
            self,
            "GitHubActionsRole",
            role_name=f"GitHubActions-{github_repo}",
            assumed_by=iam.FederatedPrincipal(
                oidc_provider.open_id_connect_provider_arn,
                conditions={
                    "StringEquals": {
                        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                    },
                    "StringLike": {
                        "token.actions.githubusercontent.com:sub": (
                            f"repo:{github_org}/{github_repo}:*"
                        ),
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
            description=f"Role for GitHub Actions to deploy {github_repo}",
        )

        # CDK deployment permissions
        github_actions_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("AdministratorAccess")
        )

        # Outputs
        CfnOutput(self, "RoleArn", value=github_actions_role.role_arn)
        CfnOutput(
            self,
            "OIDCProviderArn",
            value=oidc_provider.open_id_connect_provider_arn,
        )



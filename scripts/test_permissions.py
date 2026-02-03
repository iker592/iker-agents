#!/usr/bin/env python3
"""
Test IAM permissions for agent roles.

Usage:
    # Test all permissions for coding agent
    python scripts/test_permissions.py --role coding-agent-tf-runtime-role

    # Test specific permission
    python scripts/test_permissions.py --role coding-agent-tf-runtime-role --test code-interpreter

    # List available tests
    python scripts/test_permissions.py --list
"""

import argparse
import json
import sys
from typing import Any

import boto3
from botocore.exceptions import ClientError


def get_assumed_role_session(role_name: str, region: str = "us-east-1") -> boto3.Session:
    """Assume a role and return a session with temporary credentials."""
    sts = boto3.client("sts", region_name=region)
    account_id = sts.get_caller_identity()["Account"]
    role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"

    print(f"Assuming role: {role_arn}")
    response = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="permission-test",
        DurationSeconds=900,  # 15 minutes
    )

    creds = response["Credentials"]
    return boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name=region,
    )


def test_result(name: str, success: bool, details: str = "") -> dict[str, Any]:
    """Format test result."""
    status = "PASS" if success else "FAIL"
    icon = "\u2705" if success else "\u274c"
    print(f"  {icon} {name}: {status}")
    if details:
        print(f"     {details}")
    return {"name": name, "success": success, "details": details}


def test_code_interpreter(session: boto3.Session, region: str) -> list[dict]:
    """Test Code Interpreter permissions."""
    print("\n[Code Interpreter Tests]")
    results = []

    client = session.client("bedrock-agentcore", region_name=region)

    # Test StartCodeInterpreterSession
    try:
        # This will fail with ValidationException if we don't have a real session,
        # but AccessDeniedException if we don't have permission
        response = client.start_code_interpreter_session(
            codeInterpreterIdentifier="aws.codeinterpreter.v1",
        )
        session_id = response.get("sessionId", "unknown")
        results.append(test_result("StartCodeInterpreterSession", True, f"Session: {session_id}"))

        # Try to stop it
        try:
            client.stop_code_interpreter_session(
                codeInterpreterIdentifier="aws.codeinterpreter.v1",
                sessionId=session_id,
            )
            results.append(test_result("StopCodeInterpreterSession", True))
        except ClientError as e:
            code = e.response["Error"]["Code"]
            if code == "AccessDeniedException":
                results.append(test_result("StopCodeInterpreterSession", False, str(e)))
            else:
                results.append(test_result("StopCodeInterpreterSession", True, f"Got {code} (not access denied)"))

    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "AccessDeniedException":
            results.append(test_result("StartCodeInterpreterSession", False, str(e)))
        else:
            # Other errors (ValidationException, etc.) mean we have permission
            results.append(test_result("StartCodeInterpreterSession", True, f"Got {code} (not access denied)"))

    return results


def test_mcp_server(session: boto3.Session, region: str, mcp_server_arn: str | None = None) -> list[dict]:
    """Test MCP Server invocation permissions."""
    print("\n[MCP Server Tests]")
    results = []

    if not mcp_server_arn:
        # Try to get from terraform output
        try:
            import subprocess
            result = subprocess.run(
                ["terraform", "output", "-raw", "mcp_server_runtime_arn"],
                capture_output=True,
                text=True,
                cwd="terraform",
            )
            if result.returncode == 0 and result.stdout:
                mcp_server_arn = result.stdout.strip()
        except Exception:
            pass

    if not mcp_server_arn:
        results.append(test_result("InvokeAgentRuntime (MCP)", False, "MCP Server ARN not found"))
        return results

    client = session.client("bedrock-agentcore", region_name=region)

    try:
        # Try to invoke the MCP server with a simple request
        response = client.invoke_agent_runtime(
            agentRuntimeArn=mcp_server_arn,
            qualifier="default",
            contentType="application/json",
            payload=json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/list",
            }).encode(),
        )
        results.append(test_result("InvokeAgentRuntime (MCP)", True, "Successfully invoked MCP server"))
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "AccessDeniedException":
            results.append(test_result("InvokeAgentRuntime (MCP)", False, str(e)))
        else:
            results.append(test_result("InvokeAgentRuntime (MCP)", True, f"Got {code} (not access denied)"))

    return results


def test_memory(session: boto3.Session, region: str, memory_id: str | None = None) -> list[dict]:
    """Test Memory access permissions."""
    print("\n[Memory Tests]")
    results = []

    if not memory_id:
        # Try to get from terraform output
        try:
            import subprocess
            result = subprocess.run(
                ["terraform", "output", "-raw", "dsp_agent_memory_id"],
                capture_output=True,
                text=True,
                cwd="terraform",
            )
            if result.returncode == 0 and result.stdout:
                memory_id = result.stdout.strip()
        except Exception:
            pass

    if not memory_id:
        results.append(test_result("ListSessions (Memory)", False, "Memory ID not found"))
        return results

    client = session.client("bedrock-agentcore", region_name=region)

    # Test ListSessions
    try:
        response = client.list_sessions(memoryId=memory_id, maxResults=1)
        results.append(test_result("ListSessions (Memory)", True))
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "AccessDeniedException":
            results.append(test_result("ListSessions (Memory)", False, str(e)))
        else:
            results.append(test_result("ListSessions (Memory)", True, f"Got {code} (not access denied)"))

    # Test CreateEvent (write)
    try:
        response = client.create_event(
            memoryId=memory_id,
            actorId="test-actor",
            sessionId="test-session-123456789012345678901234567890",
            eventTimestamp="2024-01-01T00:00:00Z",
            payload={"branch": {"text": "test"}},
        )
        results.append(test_result("CreateEvent (Memory)", True))
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "AccessDeniedException":
            results.append(test_result("CreateEvent (Memory)", False, str(e)))
        else:
            results.append(test_result("CreateEvent (Memory)", True, f"Got {code} (not access denied)"))

    return results


def test_bedrock(session: boto3.Session, region: str) -> list[dict]:
    """Test Bedrock model invocation permissions."""
    print("\n[Bedrock Model Tests]")
    results = []

    client = session.client("bedrock-runtime", region_name="us-west-2")  # Models in us-west-2

    try:
        response = client.invoke_model(
            modelId="us.anthropic.claude-3-5-haiku-20241022-v1:0",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Hi"}],
            }),
        )
        results.append(test_result("InvokeModel (Bedrock)", True))
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "AccessDeniedException":
            results.append(test_result("InvokeModel (Bedrock)", False, str(e)))
        else:
            results.append(test_result("InvokeModel (Bedrock)", True, f"Got {code} (not access denied)"))

    return results


def test_ecr(session: boto3.Session, region: str) -> list[dict]:
    """Test ECR pull permissions."""
    print("\n[ECR Tests]")
    results = []

    client = session.client("ecr", region_name=region)

    try:
        response = client.get_authorization_token()
        results.append(test_result("GetAuthorizationToken (ECR)", True))
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "AccessDeniedException":
            results.append(test_result("GetAuthorizationToken (ECR)", False, str(e)))
        else:
            results.append(test_result("GetAuthorizationToken (ECR)", True, f"Got {code} (not access denied)"))

    return results


def test_cloudwatch(session: boto3.Session, region: str) -> list[dict]:
    """Test CloudWatch Logs permissions."""
    print("\n[CloudWatch Logs Tests]")
    results = []

    client = session.client("logs", region_name=region)

    try:
        response = client.describe_log_groups(limit=1)
        results.append(test_result("DescribeLogGroups (CloudWatch)", True))
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "AccessDeniedException":
            results.append(test_result("DescribeLogGroups (CloudWatch)", False, str(e)))
        else:
            results.append(test_result("DescribeLogGroups (CloudWatch)", True, f"Got {code} (not access denied)"))

    return results


TESTS = {
    "code-interpreter": test_code_interpreter,
    "mcp-server": test_mcp_server,
    "memory": test_memory,
    "bedrock": test_bedrock,
    "ecr": test_ecr,
    "cloudwatch": test_cloudwatch,
}


def main():
    parser = argparse.ArgumentParser(description="Test IAM permissions for agent roles")
    parser.add_argument("--role", "-r", help="IAM role name to test")
    parser.add_argument("--test", "-t", help="Specific test to run (default: all)")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument("--list", "-l", action="store_true", help="List available tests")
    parser.add_argument("--mcp-server-arn", help="MCP Server ARN (optional)")
    parser.add_argument("--memory-id", help="Memory ID (optional)")

    args = parser.parse_args()

    if args.list:
        print("Available tests:")
        for name in TESTS:
            print(f"  - {name}")
        return 0

    if not args.role:
        parser.error("--role is required")

    print(f"Testing permissions for role: {args.role}")
    print(f"Region: {args.region}")
    print("=" * 50)

    try:
        session = get_assumed_role_session(args.role, args.region)
    except ClientError as e:
        print(f"\nFailed to assume role: {e}")
        return 1

    all_results = []

    if args.test:
        if args.test not in TESTS:
            print(f"Unknown test: {args.test}")
            print(f"Available: {', '.join(TESTS.keys())}")
            return 1
        tests_to_run = {args.test: TESTS[args.test]}
    else:
        tests_to_run = TESTS

    for name, test_func in tests_to_run.items():
        if name == "mcp-server":
            results = test_func(session, args.region, args.mcp_server_arn)
        elif name == "memory":
            results = test_func(session, args.region, args.memory_id)
        else:
            results = test_func(session, args.region)
        all_results.extend(results)

    # Summary
    print("\n" + "=" * 50)
    passed = sum(1 for r in all_results if r["success"])
    failed = sum(1 for r in all_results if not r["success"])
    print(f"Summary: {passed} passed, {failed} failed")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

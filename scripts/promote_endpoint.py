#!/usr/bin/env python3
"""Promote an agent endpoint to a specific runtime version.

Usage:
    python promote_endpoint.py <runtime_id> <endpoint_name> [version] [region]

Examples:
    # Promote canary to latest version
    python promote_endpoint.py dsp_agent_tf-NBo13y3YHj canary

    # Promote prod to specific version
    python promote_endpoint.py dsp_agent_tf-NBo13y3YHj prod 2

    # Get current endpoint info
    python promote_endpoint.py dsp_agent_tf-NBo13y3YHj dev --info
"""

import argparse

import boto3


def get_latest_version(client, runtime_id: str) -> str:
    """Get the latest runtime version."""
    response = client.list_agent_runtime_versions(agentRuntimeId=runtime_id)
    versions = response.get("agentRuntimes", [])
    if not versions:
        raise ValueError(f"No versions found for runtime {runtime_id}")
    return versions[0]["agentRuntimeVersion"]


def get_endpoint_info(client, runtime_id: str, endpoint_name: str) -> dict:
    """Get current endpoint information."""
    response = client.get_agent_runtime_endpoint(
        agentRuntimeId=runtime_id,
        endpointName=endpoint_name,
    )
    return {
        "name": response.get("name"),
        "status": response.get("status"),
        "version": response.get("agentRuntimeVersion"),
        "arn": response.get("agentRuntimeEndpointArn"),
    }


def promote_endpoint(
    runtime_id: str,
    endpoint_name: str,
    version: str | None = None,
    region: str = "us-east-1",
) -> dict:
    """Promote an endpoint to a specific version (or latest if not specified)."""
    client = boto3.client("bedrock-agentcore-control", region_name=region)

    # Get target version
    if version is None:
        version = get_latest_version(client, runtime_id)
        print(f"Using latest version: {version}")

    # Get current endpoint info
    current = get_endpoint_info(client, runtime_id, endpoint_name)
    print(f"Current endpoint '{endpoint_name}' is at version {current['version']}")

    if current["version"] == version:
        print(f"Endpoint already at version {version}, skipping promotion")
        return current

    # Update endpoint
    print(f"Promoting endpoint '{endpoint_name}' to version {version}...")
    client.update_agent_runtime_endpoint(
        agentRuntimeId=runtime_id,
        endpointName=endpoint_name,
        agentRuntimeVersion=version,
    )

    # Get updated info
    updated = get_endpoint_info(client, runtime_id, endpoint_name)
    print(f"Endpoint '{endpoint_name}' promoted to version {updated['version']}")
    return updated


def main():
    parser = argparse.ArgumentParser(description="Promote an agent endpoint")
    parser.add_argument("runtime_id", help="Agent runtime ID")
    parser.add_argument("endpoint_name", help="Endpoint name (dev, canary, prod)")
    parser.add_argument("version", nargs="?", help="Target version (default: latest)")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument("--info", action="store_true", help="Show endpoint info only")

    args = parser.parse_args()

    client = boto3.client("bedrock-agentcore-control", region_name=args.region)

    if args.info:
        info = get_endpoint_info(client, args.runtime_id, args.endpoint_name)
        print(f"Endpoint: {info['name']}")
        print(f"Status: {info['status']}")
        print(f"Version: {info['version']}")
        print(f"ARN: {info['arn']}")
        return

    promote_endpoint(
        args.runtime_id,
        args.endpoint_name,
        args.version,
        args.region,
    )


if __name__ == "__main__":
    main()

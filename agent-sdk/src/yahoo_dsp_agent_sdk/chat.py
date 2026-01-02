#!/usr/bin/env python3
"""Interactive chat for both local and AWS Bedrock AgentCore agents."""

import argparse
import json
import sys
import time
import uuid
from datetime import datetime

import boto3
import httpx

# ANSI colors
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
RED = "\033[91m"
BLUE = "\033[94m"
WHITE = "\033[97m"
BOLD = "\033[1m"
RESET = "\033[0m"


def format_agui_event(data: dict) -> str:
    """Format AG-UI protocol events with nice colors."""
    event_type = data.get("type")

    if event_type == "RUN_STARTED":
        separator = f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}"
        return f"{separator}\n{BLUE}│{RESET} {WHITE}{BOLD}Run Started{RESET}\n{separator}\n"

    elif event_type == "TEXT_MESSAGE_START":
        return f"{GREEN}{BOLD}💬 Assistant:{RESET}\n"

    elif event_type == "TEXT_MESSAGE_CONTENT":
        delta = data.get("delta", "")
        return f"{WHITE}{delta}{RESET}"

    elif event_type == "TEXT_MESSAGE_END":
        return "\n"

    elif event_type == "TOOL_CALL_START":
        tool_name = data.get("toolCallName", "unknown")
        box_top = f"{YELLOW}┌─────────────────────────────────────────────────┐{RESET}"
        box_mid = f"{YELLOW}├─────────────────────────────────────────────────┤{RESET}"
        return (
            f"\n{box_top}\n"
            f"{YELLOW}│{RESET} {MAGENTA}{BOLD}🔧 Tool Call:{RESET} {WHITE}{tool_name}{RESET}\n"
            f"{box_mid}\n"
            f"{YELLOW}│{RESET} {CYAN}Args:{RESET} "
        )

    elif event_type == "TOOL_CALL_ARGS":
        delta = data.get("delta", "")
        return f"{WHITE}{delta}{RESET}"

    elif event_type == "TOOL_CALL_RESULT":
        result = data.get("content", "No result")
        return f"\n{YELLOW}│{RESET} {GREEN}Result:{RESET} {WHITE}{result}{RESET}"

    elif event_type == "TOOL_CALL_END":
        return f"\n{YELLOW}└─────────────────────────────────────────────────┘{RESET}\n"

    elif event_type == "RUN_FINISHED":
        result = data.get("result")
        separator = f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}"
        output = f"\n{separator}\n{BLUE}│{RESET} {GREEN}{BOLD}✅ Run Finished{RESET}"
        if result and result != "null":
            box_mid = f"{BLUE}├─────────────────────────────────────────────────┤{RESET}"
            output += f"\n{box_mid}\n{BLUE}│{RESET} {MAGENTA}{BOLD}📊 Structured Output:{RESET}\n"
            try:
                result_json = json.dumps(result, indent=2)
                for line in result_json.split("\n"):
                    output += f"{BLUE}│{RESET}   {line}\n"
            except Exception:
                output += f"{BLUE}│{RESET}   {result}\n"
        output += f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n"
        return output

    return ""


def invoke_aws(
    client,
    runtime_arn: str,
    session_id: str,
    user_id: str,
    message: str,
    qualifier: str | None = None,
    mode: str = "agui",
):
    """Invoke AWS Bedrock AgentCore and process streaming response."""
    body = {
        "input": message,
        "user_id": user_id,
        "session_id": session_id,
        "stream": mode == "stream",
        "stream_agui": mode == "agui",
    }

    invoke_params = {
        "agentRuntimeArn": runtime_arn,
        "runtimeSessionId": session_id,
        "payload": json.dumps(body),
    }

    if qualifier and qualifier not in ("DEFAULT", ""):
        invoke_params["qualifier"] = qualifier

    response = client.invoke_agent_runtime(**invoke_params)
    content_type = response.get("contentType", "")

    if "text/event-stream" in content_type:
        first_message = True
        for line in response["response"].iter_lines(chunk_size=1024):
            if not line:
                continue
            line_str = line.decode("utf-8")
            if line_str.startswith("data: "):
                try:
                    data = json.loads(line_str[6:])
                    if mode == "agui":
                        formatted = format_agui_event(data)
                        if formatted:
                            if data.get("type") == "TEXT_MESSAGE_START" and first_message:
                                print(formatted, end="", flush=True)
                                first_message = False
                            elif data.get("type") != "TEXT_MESSAGE_START":
                                print(formatted, end="", flush=True)
                    else:
                        # Plain text streaming
                        if data.get("type") == "chunk":
                            print(data.get("content", ""), end="", flush=True)
                        elif data.get("type") == "start":
                            print(f"{CYAN}[Session: {data.get('session_id')}]{RESET}")
                        elif data.get("type") == "end":
                            print(f"\n{GREEN}[Done]{RESET}")
                except json.JSONDecodeError:
                    continue
    else:
        response_body = response["response"].read()
        response_data = json.loads(response_body)
        print(f"{GREEN}{BOLD}💬 Assistant:{RESET}")
        print(response_data.get("content", ""))


def invoke_local(
    url: str,
    endpoint: str,
    session_id: str,
    user_id: str,
    message: str,
    mode: str = "agui",
):
    """Invoke local agent via HTTP and process streaming response."""
    body = {
        "input": message,
        "user_id": user_id,
        "session_id": session_id,
        "stream": mode == "stream",
        "stream_agui": mode == "agui",
    }

    full_url = f"{url}/{endpoint}"

    with httpx.Client(timeout=120.0) as client:
        with client.stream(
            "POST",
            full_url,
            json=body,
            headers={"Accept": "text/event-stream"},
        ) as response:
            if "text/event-stream" in response.headers.get("content-type", ""):
                first_message = True
                for line in response.iter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            if mode == "agui":
                                formatted = format_agui_event(data)
                                if formatted:
                                    if data.get("type") == "TEXT_MESSAGE_START" and first_message:
                                        print(formatted, end="", flush=True)
                                        first_message = False
                                    elif data.get("type") != "TEXT_MESSAGE_START":
                                        print(formatted, end="", flush=True)
                            else:
                                if data.get("type") == "chunk":
                                    print(data.get("content", ""), end="", flush=True)
                                elif data.get("type") == "start":
                                    print(f"{CYAN}[Session: {data.get('session_id')}]{RESET}")
                                elif data.get("type") == "end":
                                    print(f"\n{GREEN}[Done]{RESET}")
                        except json.JSONDecodeError:
                            continue
            else:
                response_data = response.json()
                print(f"{GREEN}{BOLD}💬 Assistant:{RESET}")
                print(response_data.get("content", ""))


def main():
    parser = argparse.ArgumentParser(
        description="Interactive chat for local and AWS Bedrock AgentCore agents"
    )

    # Mode selection
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--endpoint",
        help="Local endpoint to chat with (e.g., invocations)",
    )
    group.add_argument(
        "--runtime-arn",
        help="AWS Bedrock AgentCore runtime ARN (enables AWS mode)",
    )

    # Common options
    parser.add_argument(
        "--mode",
        choices=["agui", "stream", "sync"],
        default="agui",
        help="Response mode (default: agui)",
    )
    parser.add_argument("--session-id", help="Session ID for memory persistence")
    parser.add_argument("--user-id", help="User ID")
    parser.add_argument(
        "--url",
        default="http://localhost:8080",
        help="Base URL for local mode (default: localhost:8080)",
    )
    parser.add_argument(
        "--aws-endpoint",
        help="AWS endpoint qualifier: dev, canary, prod",
    )
    parser.add_argument(
        "--aws-region",
        default="us-east-1",
        help="AWS region (default: us-east-1)",
    )
    parser.add_argument(
        "--default",
        action="store_true",
        help="Use default settings (skip prompts)",
    )

    args = parser.parse_args()

    # Determine mode
    use_aws = args.runtime_arn is not None

    if not use_aws and not args.endpoint:
        error_msg = (
            f"{RED}Error: Either --endpoint (for local) or "
            f"--runtime-arn (for AWS) is required{RESET}"
        )
        print(error_msg)
        print(f"{YELLOW}Examples:{RESET}")
        local_example = (
            f"  {CYAN}Local: python -m yahoo_dsp_agent_sdk.chat --endpoint=invocations{RESET}"
        )
        print(local_example)
        aws_example = (
            f"  {CYAN}AWS: python -m yahoo_dsp_agent_sdk.chat "
            f"--runtime-arn=arn:aws:bedrock-agentcore:...{RESET}"
        )
        print(aws_example)
        sys.exit(1)

    # Generate session/user IDs if not provided
    session_id = args.session_id or f"session-{uuid.uuid4().hex}"
    user_id = args.user_id or "user"

    # Initialize AWS client if needed
    aws_client = None
    if use_aws:
        aws_client = boto3.client("bedrock-agentcore", region_name=args.aws_region)

    # Print header
    print(f"{BOLD}{BLUE}🤖 Agent Chat{RESET}")
    if use_aws:
        runtime_name = (
            args.runtime_arn.split("/")[-1] if "/" in args.runtime_arn else args.runtime_arn
        )
        print(f"{CYAN}Runtime: {WHITE}{runtime_name}{RESET}")
        if args.aws_endpoint:
            print(f"{CYAN}AWS Endpoint: {WHITE}{args.aws_endpoint}{RESET}")
        print(f"{CYAN}Region: {WHITE}{args.aws_region}{RESET}")
    else:
        print(f"{CYAN}URL: {WHITE}{args.url}/{args.endpoint}{RESET}")
    print(f"{CYAN}Mode: {WHITE}{args.mode}{RESET}")
    print(f"{CYAN}Session: {WHITE}{session_id}{RESET}")
    print(f"{CYAN}User: {WHITE}{user_id}{RESET}\n")

    print(f"{GREEN}🔄 Interactive Chat Mode{RESET}")
    print(f"{CYAN}Type your messages (type 'exit' to quit){RESET}\n")

    # Interactive loop
    while True:
        try:
            timestamp = datetime.now().strftime("%H:%M:%S")
            message = input(f"{CYAN}[{timestamp}]{RESET} {GREEN}You > {RESET}")

            if message.lower() == "exit":
                print(f"{YELLOW}Goodbye!{RESET}")
                break

            if not message.strip():
                print(f"{RED}❌ Please enter a message{RESET}")
                continue

            print(f"\n{WHITE}{BOLD}You:{RESET} {message}\n")

            start_time = time.time()

            try:
                if use_aws:
                    invoke_aws(
                        aws_client,
                        args.runtime_arn,
                        session_id,
                        user_id,
                        message,
                        args.aws_endpoint,
                        args.mode,
                    )
                else:
                    invoke_local(
                        args.url,
                        args.endpoint,
                        session_id,
                        user_id,
                        message,
                        args.mode,
                    )
            except Exception as e:
                print(f"{RED}Error: {e}{RESET}")
                continue

            elapsed = time.time() - start_time
            print(f"\n{YELLOW}⚡ Completed in {elapsed:.2f}s{RESET}\n")

        except KeyboardInterrupt:
            print(f"\n{YELLOW}Goodbye!{RESET}")
            break
        except EOFError:
            break


if __name__ == "__main__":
    main()

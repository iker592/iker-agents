#!/usr/bin/env python3
"""Interactive chat for deployed AWS Bedrock AgentCore agents."""

import json
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import boto3

from agents.dsp.settings import Settings

# Colors
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
RED = "\033[91m"
BLUE = "\033[94m"
WHITE = "\033[97m"
BOLD = "\033[1m"
RESET = "\033[0m"


def format_agui_event(data: dict, in_text_stream: bool = False):
    """Format AG-UI protocol events with nice colors."""
    event_type = data.get("type")
    
    if event_type == "RUN_STARTED":
        return f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n{BLUE}│{RESET} {WHITE}{BOLD}Run Started{RESET}\n{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n"
    
    elif event_type == "TEXT_MESSAGE_START":
        return f"{GREEN}{BOLD}💬 Assistant:{RESET}\n"
    
    elif event_type == "TEXT_MESSAGE_CONTENT":
        delta = data.get("delta", "")
        return f"{WHITE}{delta}{RESET}"
    
    elif event_type == "TEXT_MESSAGE_END":
        return "\n"
    
    elif event_type == "TOOL_CALL_START":
        tool_name = data.get("toolCallName", "unknown")
        return f"\n{YELLOW}┌─────────────────────────────────────────────────┐{RESET}\n{YELLOW}│{RESET} {MAGENTA}{BOLD}🔧 Tool Call:{RESET} {WHITE}{tool_name}{RESET}\n{YELLOW}├─────────────────────────────────────────────────┤{RESET}\n{YELLOW}│{RESET} {CYAN}Args:{RESET} "
    
    elif event_type == "TOOL_CALL_ARGS":
        delta = data.get("delta", "")
        return f"{WHITE}{delta}{RESET}"
    
    elif event_type == "TOOL_CALL_RESULT":
        result = data.get("content", "No result")
        return f"\n{YELLOW}│{RESET} {GREEN}Result:{RESET} {WHITE}{result}{RESET}"
    
    elif event_type == "TOOL_CALL_END":
        return f"{YELLOW}└─────────────────────────────────────────────────┘{RESET}\n"
    
    elif event_type == "RUN_FINISHED":
        result = data.get("result")
        output = f"\n{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n{BLUE}│{RESET} {GREEN}{BOLD}✅ Run Finished{RESET}"
        if result and result != "null":
            output += f"\n{BLUE}├─────────────────────────────────────────────────┤{RESET}\n{BLUE}│{RESET} {MAGENTA}{BOLD}📊 Structured Output:{RESET}\n"
            try:
                result_json = json.dumps(result, indent=2)
                for line in result_json.split("\n"):
                    output += f"{BLUE}│{RESET}   {line}\n"
            except:
                output += f"{BLUE}│{RESET}   {result}\n"
        output += f"{BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}\n"
        return output
    
    return ""


def invoke_agent(
    client,
    runtime_arn: str,
    session_id: str,
    user_id: str,
    input_text: str,
    endpoint: str | None = None,
    stream_agui: bool = True,
):
    """Invoke the agent and return the response stream."""
    body = {
        "input": input_text,
        "user_id": user_id,
        "session_id": session_id,
        "stream": not stream_agui,
        "stream_agui": stream_agui,
    }
    
    invoke_params = {
        "agentRuntimeArn": runtime_arn,
        "runtimeSessionId": session_id,
        "payload": json.dumps(body),
    }
    if endpoint and endpoint != "DEFAULT":
        invoke_params["qualifier"] = endpoint
    
    response = client.invoke_agent_runtime(**invoke_params)
    return response


def process_response(response, stream_agui: bool = True):
    """Process the streaming response from the agent."""
    content_type = response.get("contentType", "")
    
    if "text/event-stream" not in content_type:
        # Non-streaming response
        response_body = response["response"].read()
        response_data = json.loads(response_body)
        print(f"{GREEN}{BOLD}💬 Assistant:{RESET}")
        print(response_data.get("content", ""))
        return
    
    # Streaming response
    in_text_stream = False
    first_message = True
    
    for line in response["response"].iter_lines(chunk_size=1024):
        if not line:
            continue
        
        line = line.decode("utf-8")
        
        if line.startswith("data: "):
            try:
                data = json.loads(line[6:])
                
                if stream_agui:
                    formatted = format_agui_event(data, in_text_stream)
                    if formatted:
                        if data.get("type") == "TEXT_MESSAGE_START":
                            if first_message:
                                print(formatted, end="", flush=True)
                                first_message = False
                        else:
                            print(formatted, end="", flush=True)
                        
                        if data.get("type") == "TEXT_MESSAGE_START":
                            in_text_stream = True
                        elif data.get("type") == "TEXT_MESSAGE_END":
                            in_text_stream = False
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


def main():
    """Main interactive chat loop."""
    settings = Settings()
    
    # Get runtime ARN from environment or settings
    runtime_arn = os.environ.get("AGENT_RUNTIME_ARN") or settings.agent_runtime_arn
    if not runtime_arn:
        print(f"{RED}Error: AGENT_RUNTIME_ARN not set.{RESET}")
        print(f"{YELLOW}Usage: AGENT_RUNTIME_ARN=<arn> AGENT_ENDPOINT=<endpoint> python scripts/chat_aws.py{RESET}")
        print(f"{YELLOW}Or use: make chat-aws STACK=<stack> ENDPOINT=<endpoint>{RESET}")
        sys.exit(1)
    
    endpoint = os.environ.get("AGENT_ENDPOINT")
    session_id = os.environ.get("SESSION_ID") or f"session-{uuid.uuid4().hex}"
    user_id = os.environ.get("USER_ID") or os.getenv("USER", "user")
    stream_agui = os.environ.get("STREAM_AGUI", "true").lower() == "true"
    
    # Initialize boto3 client
    client = boto3.client("bedrock-agentcore", region_name=settings.aws_region)
    
    print(f"{BOLD}{BLUE}🤖 AWS Agent Chat{RESET}")
    print(f"{CYAN}Runtime: {WHITE}{runtime_arn.split('/')[-1]}{RESET}")
    if endpoint:
        print(f"{CYAN}Endpoint: {WHITE}{endpoint}{RESET}")
    print(f"{CYAN}Mode: {WHITE}{'AG-UI Streaming' if stream_agui else 'Plain Text Streaming'}{RESET}")
    print(f"{CYAN}Session: {WHITE}{session_id}{RESET}")
    print(f"{CYAN}User: {WHITE}{user_id}{RESET}\n")
    
    print(f"{GREEN}🔄 Interactive Chat Mode{RESET}")
    print(f"{CYAN}Type your messages (type 'exit' to quit){RESET}\n")
    
    while True:
        try:
            timestamp = datetime.now().strftime("%H:%M:%S")
            message = input(f"{CYAN}[{timestamp}]{RESET} {GREEN}You > {RESET}")
            
            if message.lower() == "exit":
                console.print(f"{YELLOW}Goodbye!{RESET}")
                break
            
            if not message.strip():
                print(f"{RED}❌ Please enter a message{RESET}")
                continue
            
            print(f"\n{WHITE}{BOLD}You:{RESET} {message}\n")
            
            start_time = time.time()
            
            try:
                response = invoke_agent(
                    client,
                    runtime_arn,
                    session_id,
                    user_id,
                    message,
                    endpoint,
                    stream_agui,
                )
                process_response(response, stream_agui)
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


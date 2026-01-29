# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A multi-agent platform built with **AWS Bedrock AgentCore** + **Strands Agents** + **Yahoo DSP Agent SDK**. Agents deploy as fully managed AWS serverless runtimes with persistent conversation memory.

## Build & Development Commands

```bash
# Setup (installs uv, syncs deps, configures git hooks)
make setup

# Run locally (uses in-memory state)
make local

# Run locally with AWS memory persistence
make local MEMORY_ID=<memory-id>

# Run specific agent locally
make local-agent AGENT=dsp|research|coding

# Docker development
make start       # Start container
make dev         # Hot reload mode
make logs        # View logs

# Code quality
make lint        # Check with ruff
make format      # Format with ruff
make fix         # Auto-fix linting issues
make check       # Run all checks (used by pre-commit)
```

## Testing

```bash
make test              # Run all tests
make test-unit         # Run unit tests only
make test-e2e          # Run e2e tests (requires deployed agent)

# Run single test file
uv run pytest tests/unit/test_agent.py -v

# Run single test
uv run pytest tests/unit/test_agent.py::TestAgentCreation::test_create_agent_without_memory -v
```

Test markers: `@pytest.mark.unit` and `@pytest.mark.e2e`

## Deployment

```bash
make aws-auth           # Authenticate to AWS
make deploy             # Deploy DSPAgentStack
make deploy-all         # Deploy all agent stacks
make deploy-oidc        # One-time: set up GitHub OIDC for CI/CD

# Invoke deployed agent
make invoke INPUT="Hello" STACK=DSPAgentStack ENDPOINT=dev|canary|prod
make invoke-stream INPUT="Hello"  # Plain text streaming
make invoke-agui INPUT="Hello"    # AG-UI protocol streaming

# Interactive chat with deployed agent
make chat-aws STACK=DSPAgentStack ENDPOINT=dev
```

## Architecture

```
agents/                    # Agent implementations
  dsp/                     # Main DSP agent
    main.py                # BedrockAgentCoreApp entrypoint with @app.entrypoint
    agent.py               # Agent creation with tools and memory config
    settings.py            # Pydantic settings
  research/                # Research agent variant
  coding/                  # Coding agent variant

agent-sdk/                 # yahoo-dsp-agent-sdk (editable dependency)
  src/yahoo_dsp_agent_sdk/
    agent.py               # Agent class wrapping Strands
    response_handler.py    # Handle agent responses (streaming/non-streaming)
    agui_bridge.py         # AG-UI protocol streaming
    chat.py                # Interactive chat CLI

iac/                       # AWS CDK infrastructure
  stack.py                 # DSPAgentStack (main agent with endpoints)
  base_stack.py            # AgentStack (reusable base for new agents)
  github_oidc_stack.py     # GitHub Actions OIDC auth

scripts/
  invoke.py                # CLI to invoke deployed agents
  get_latest_version.py    # Get latest runtime version
```

## Key Patterns

**Agent Creation (agents/dsp/agent.py):**
- Uses `BedrockModel` from strands with boto3 session
- Optional `AgentCoreMemorySessionManager` for persistence
- Returns configured `Agent` from yahoo-dsp-agent-sdk

**Agent Entrypoint (agents/dsp/main.py):**
- Uses `BedrockAgentCoreApp` with `@app.entrypoint` decorator
- Extracts `user_id`, `session_id` from payload/context
- Calls `handle_agent_response()` for streaming/non-streaming output

**CDK Stacks (iac/):**
- Each agent gets: Memory, Runtime, and dev/canary/prod endpoints
- Outputs: RuntimeArn, RuntimeId, MemoryId, EndpointArns
- Stored in `cdk-outputs.json` after deploy

## Adding a New Agent

1. Create `agents/<name>/` with `main.py`, `agent.py`, `settings.py`
2. Add CDK stack in `iac/` extending `AgentStack` from `base_stack.py`
3. Register stack in `iac/app.py`
4. Add to docker-compose.yml services
5. Update Makefile multi-agent commands

## Dependencies

- Python 3.13+
- uv (package manager)
- Docker (for containerized dev)
- AWS CLI + credentials
- `yahoo-dsp-agent-sdk` is an editable local dependency at `agent-sdk/`

## CI/CD

- PRs: `.github/workflows/pr.yml` runs `make pipeline-pr` (lint, unit tests)
- Merge to main: `.github/workflows/deploy.yml` deploys all stacks, runs e2e, promotes to canary/prod

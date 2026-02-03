# Architecture

This document describes the architecture of the iker-agents multi-agent platform built on AWS Bedrock AgentCore.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Interface                                  │
│                         (React + Vite + AG-UI)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API Gateway                                       │
│                    (Lambda + Cognito Auth)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AWS Bedrock AgentCore                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   DSP Agent     │  │ Research Agent  │  │  Coding Agent   │             │
│  │   (Runtime)     │  │   (Runtime)     │  │   (Runtime)     │             │
│  └────────┬────────┘  └─────────────────┘  └─────────────────┘             │
│           │                                                                  │
│           │ boto3.invoke_agent_runtime()                                    │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │   MCP Server    │                                                        │
│  │   (Runtime)     │                                                        │
│  │  - Customers    │                                                        │
│  │  - Orders       │                                                        │
│  │  - Analytics    │                                                        │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AWS Bedrock                                          │
│                    (Claude 3.5 Sonnet)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Agents (AgentCore Runtimes)

Agents are deployed as **AWS Bedrock AgentCore Runtimes** - fully managed serverless containers that handle scaling, auth, and observability automatically.

**Location:** `agents/`

Each agent consists of:
- `main.py` - BedrockAgentCoreApp entrypoint with `@app.entrypoint` decorator
- `agent.py` - Agent creation with tools, memory config, and model settings
- `settings.py` - Pydantic settings for configuration

**Agent Flow:**
```
1. Request arrives at AgentCore Runtime
2. @app.entrypoint handler extracts user_id, session_id
3. Agent is created with memory manager (for conversation persistence)
4. Agent processes request using Bedrock LLM + tools
5. Response streams back via AG-UI protocol
```

**Available Agents:**

| Agent | Location | Tools | System Prompt |
|-------|----------|-------|---------------|
| **DSP Agent** | `agents/dsp/` | MCP tools (customers, orders, analytics) | Business analyst with access to customer, order, and analytics data |
| **Research Agent** | `agents/research/` | `calculator`, `http_request` | Research specialist for gathering information and analyzing data |
| **Coding Agent** | `agents/coding/` | `calculator`, `python_repl` | Python coding specialist for writing and executing code |

**Note:** The Coding Agent requires `PYTHON_REPL_PERSISTENCE_DIR=/tmp/repl_state` environment variable and the directory must exist in the container (created in Dockerfile).

### 2. MCP Server (Tool Provider)

The MCP Server provides business tools to agents via the **Model Context Protocol (MCP)**.

**Location:** `agents/mcp-server/`

**Architecture:**
```
┌──────────────────────────────────────────────────┐
│              MCP Server Runtime                   │
│  ┌────────────────────────────────────────────┐  │
│  │         BedrockAgentCoreApp                │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │           FastMCP Server             │  │  │
│  │  │  ┌────────────┐ ┌────────────────┐   │  │  │
│  │  │  │ Customers  │ │    Orders      │   │  │  │
│  │  │  │  Tools     │ │    Tools       │   │  │  │
│  │  │  └────────────┘ └────────────────┘   │  │  │
│  │  │  ┌────────────┐ ┌────────────────┐   │  │  │
│  │  │  │ Analytics  │ │   Forecast     │   │  │  │
│  │  │  │  Tools     │ │    Tools       │   │  │  │
│  │  │  └────────────┘ └────────────────┘   │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**MCP JSON-RPC Protocol:**
```json
// Request (tools/call)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_customer",
    "arguments": {"customer_id": "cust-001"}
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{"type": "text", "text": "{...customer data...}"}]
  }
}
```

**Available Tools:**
- `get_customer` - Get customer by ID
- `list_customers` - List all customers (with tier filter)
- `search_customers` - Search by name/email
- `get_order` - Get order by ID
- `list_orders` - List orders (with filters)
- `create_order` - Create new order
- `get_analytics` - Get business KPIs
- `get_revenue_forecast` - Revenue projections

### 3. Agent-to-MCP Communication

Agents call the MCP server using **boto3 `invoke_agent_runtime`** with IAM authentication (SigV4).

**Location:** `agents/dsp/mcp_client.py`

```python
# Agent calls MCP server
client = boto3.client("bedrock-agentcore")
response = client.invoke_agent_runtime(
    agentRuntimeArn=MCP_SERVER_ARN,
    qualifier="default",
    contentType="application/json",
    payload=json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "get_customer", "arguments": {...}}
    }).encode()
)
```

**Why boto3 instead of HTTP?**
- AgentCore runtimes use IAM auth (SigV4 signing)
- boto3 handles auth automatically
- No need for JWT tokens or custom auth

### 4. UI (React + AG-UI)

**Location:** `ui/`

The UI uses the **AG-UI protocol** for real-time streaming of agent responses.

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              AG-UI Client                        │    │
│  │  - Streams agent responses in real-time         │    │
│  │  - Handles tool calls and results               │    │
│  │  - Manages conversation state                   │    │
│  │  - Selects agent runtime dynamically            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key UI Components:**

| File | Purpose |
|------|---------|
| `ui/src/pages/Chat.tsx` | Main chat interface with agent selector |
| `ui/src/services/api.ts` | API client with `invokeAgentDirect()` for streaming |
| `ui/src/hooks/useAgents.ts` | Fetches agents and maps API response to UI types |
| `ui/src/types/agent.ts` | TypeScript types including `runtime_arn` |

**Agent Selection Flow:**
```
1. useAgents() fetches agent list from API (includes runtime_arn)
2. User selects agent from dropdown
3. Chat.tsx gets selected agent's runtime_arn
4. invokeAgentDirect() calls AgentCore with that specific runtime ARN
5. Each agent responds with its own personality/tools
```

### 5. Memory (Conversation Persistence)

Each agent has a dedicated **AgentCore Memory** resource for conversation history.

```
┌─────────────────────────────────────────────────────────┐
│                  AgentCore Memory                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Session 1: user_123                            │    │
│  │    - Message 1: "List customers"                │    │
│  │    - Message 2: [tool call: list_customers]     │    │
│  │    - Message 3: "Here are your customers..."    │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Session 2: user_456                            │    │
│  │    - ...                                        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Infrastructure

### Terraform Modules

**Location:** `terraform/`

```
terraform/
├── main.tf              # Root module, orchestrates all resources
├── ecr.tf               # ECR repositories for Docker images
├── outputs.tf           # Stack outputs
├── modules/
│   ├── agent/           # AgentCore Runtime + Memory + Endpoints
│   │   ├── main.tf      # Runtime, Memory resources
│   │   ├── iam.tf       # IAM roles and policies
│   │   └── variables.tf
│   ├── mcp-server/      # MCP Server Runtime
│   │   ├── main.tf      # Runtime resource (no Memory needed)
│   │   └── variables.tf
│   └── gateway/         # API Gateway + Lambda
│       ├── main.tf
│       └── variables.tf
```

### IAM Permissions

```
┌─────────────────────────────────────────────────────────┐
│              Agent Runtime IAM Role                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Permissions:                                    │    │
│  │  - bedrock:InvokeModel (call Claude)            │    │
│  │  - bedrock-agentcore:* (memory operations)      │    │
│  │  - bedrock-agentcore:InvokeAgentRuntime         │    │
│  │    (call MCP server)                            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## CI/CD Pipeline

**Location:** `.github/workflows/`

### Main Pipeline (terraform-merge.yml)

```
┌─────────────────────────────────────────────────────────┐
│                    Push to main                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  Ensure ECR Repos   │
              └──────────┬──────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │           │        │        │           │
    ▼           ▼        ▼        ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  DSP   │ │Research│ │ Coding │ │  MCP   │ │  UI    │
│ Agent  │ │ Agent  │ │ Agent  │ │ Server │ │ Build  │
└───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
    │          │          │          │          │
    └──────────┴──────────┴──────────┴──────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  Terraform Deploy   │
              │  (all 3 agents)     │
              └──────────┬──────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌─────────────────┐           ┌─────────────────┐
│ Promote DSP     │           │ Deploy UI to S3 │
│ Research, Coding│           │ + CloudFront    │
│ to Canary       │           │ Invalidation    │
└────────┬────────┘           └─────────────────┘
         ▼
┌─────────────────┐
│ E2E Tests       │
│ (Canary)        │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Promote All     │
│ to Prod         │
└─────────────────┘
```

**Build Jobs (Parallel):**
- `build-and-push` - DSP Agent image
- `build-research-agent` - Research Agent image
- `build-coding-agent` - Coding Agent image
- `build-mcp-server` - MCP Server image
- `build-ui` - React frontend bundle

### PR Pipeline (pr.yml)

```
┌─────────────────────────────────────────────────────────┐
│                    Pull Request                          │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│   Lint & Test       │       │   Full Preview      │
│   (always runs)     │       │   (if changes)      │
└─────────────────────┘       └──────────┬──────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  Detect Changes     │
                              │  - DSP Agent?       │
                              │  - Research Agent?  │
                              │  - UI?              │
                              └──────────┬──────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  Deploy Preview     │
                              │  Stack (PR-N)       │
                              └──────────┬──────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  Comment PR with    │
                              │  Preview URL        │
                              └─────────────────────┘
```

## Docker Images

### Agent Dockerfile

```dockerfile
FROM public.ecr.aws/docker/library/python:3.13-slim
WORKDIR /app

# Build arg for selecting which agent to include
ARG AGENT_PATH=./agents/dsp

COPY requirements.txt .
RUN pip install -r requirements.txt
COPY ${AGENT_PATH} /app/agent

# AgentCore requires non-root user
# Create /tmp/repl_state for python_repl tool (Coding Agent)
RUN useradd -m -u 1000 bedrock_agentcore && \
    mkdir -p /tmp/repl_state && \
    chown bedrock_agentcore:bedrock_agentcore /tmp/repl_state
USER bedrock_agentcore

EXPOSE 8080  # AgentCore standard port

# OpenTelemetry instrumentation required
CMD ["opentelemetry-instrument", "python", "-m", "agent.main"]
```

### MCP Server Dockerfile

```dockerfile
FROM public.ecr.aws/docker/library/python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY server.py .
RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore
EXPOSE 8080
CMD ["opentelemetry-instrument", "python", "server.py"]
```

**Key Requirements:**
- Use AWS ECR base images (not Docker Hub)
- Port 8080 (AgentCore standard)
- Non-root user `bedrock_agentcore`
- OpenTelemetry instrumentation wrapper

## Authentication

### User Authentication (UI → API)
- **Cognito User Pool** for user management
- JWT tokens passed in Authorization header
- API Gateway validates tokens

### Service Authentication (Agent → MCP)
- **IAM (SigV4)** for agent-to-agent calls
- Agent runtime has IAM role with `InvokeAgentRuntime` permission
- boto3 handles signing automatically

```
┌─────────────┐  JWT Token   ┌─────────────┐
│     UI      │ ───────────▶ │ API Gateway │
└─────────────┘              └──────┬──────┘
                                    │ Cognito
                                    ▼ Validates
                             ┌─────────────┐
                             │   Lambda    │
                             └──────┬──────┘
                                    │ IAM Role
                                    ▼
                             ┌─────────────┐  IAM (SigV4)  ┌─────────────┐
                             │    Agent    │ ────────────▶ │ MCP Server  │
                             └─────────────┘               └─────────────┘
```

## Local Development

```bash
# Run agent locally (in-memory state)
make local

# Run with AWS memory persistence
make local MEMORY_ID=<memory-id>

# Run specific agent
make local-agent AGENT=dsp

# Docker development
make start    # Start container
make dev      # Hot reload
make logs     # View logs
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `agents/dsp/main.py` | DSP Agent entrypoint |
| `agents/dsp/agent.py` | Agent creation with tools |
| `agents/dsp/mcp_client.py` | MCP server client (boto3) |
| `agents/dsp/mcp_tools.py` | Tool wrappers for Strands |
| `agents/mcp-server/server.py` | MCP server with FastMCP |
| `terraform/main.tf` | Infrastructure orchestration |
| `terraform/modules/agent/` | Agent runtime module |
| `terraform/modules/mcp-server/` | MCP server module |
| `.github/workflows/terraform-merge.yml` | Main CI/CD pipeline |

## Troubleshooting

### Common Issues

**1. Coding Agent fails with "Permission denied: /app/repl_state"**
- The `python_repl` tool from `strands_tools` needs a writable persistence directory
- Fix: Set `PYTHON_REPL_PERSISTENCE_DIR=/tmp/repl_state` env var AND create the directory in Dockerfile
- The directory must exist before the env var is validated

**2. Agent returns 424 "Failed Dependency" error**
- Check CloudWatch logs: `/aws/bedrock-agentcore/runtimes/<runtime-name>-<id>-DEFAULT`
- Common causes: import errors, missing dependencies, permission issues

**3. All agents respond as "business analyst"**
- UI was using hardcoded `VITE_RUNTIME_ARN` for all agents
- Fix: Pass selected agent's `runtime_arn` to `invokeAgentDirect()`

**4. Tool calls fail silently**
- Check agent IAM role has `bedrock-agentcore:InvokeAgentRuntime` permission for MCP server ARN
- Verify MCP server is deployed and healthy

### Viewing Logs

```bash
# List log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/bedrock-agentcore"

# Tail recent logs
aws logs tail "/aws/bedrock-agentcore/runtimes/<runtime-name>-DEFAULT" --since 10m --format short

# Filter for errors
aws logs tail "/aws/bedrock-agentcore/runtimes/<runtime-name>-DEFAULT" --since 1h --filter-pattern "ERROR"
```

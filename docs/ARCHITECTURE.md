# Architecture Documentation

This document provides a comprehensive overview of the multi-agent platform built with **AWS Bedrock AgentCore**, **Strands Agents**, and the **Yahoo DSP Agent SDK**.

## Table of Contents

1. [System Overview](#system-overview)
2. [Infrastructure (Terraform)](#infrastructure-terraform)
3. [Authentication Flow](#authentication-flow)
4. [Agent Runtime](#agent-runtime)
5. [Streaming Protocol (AG-UI)](#streaming-protocol-ag-ui)
6. [Frontend Architecture](#frontend-architecture)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Browser                                    │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     React UI (CloudFront + S3)                        │  │
│  │                                                                       │  │
│  │  1. Login via Cognito Hosted UI                                       │  │
│  │  2. Get JWT access token                                              │  │
│  │  3. Direct streaming to AgentCore with JWT                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + JWT Bearer Token
                                    │ AG-UI Streaming (SSE)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AWS Bedrock AgentCore                                 │
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │   JWT Authorizer  │────▶│  Agent Runtime   │────▶│  Bedrock Claude  │   │
│  │  (Cognito OIDC)  │     │   (Container)    │     │    (LLM API)     │   │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘   │
│                                    │                                        │
│                                    │                                        │
│                           ┌────────▼────────┐                               │
│                           │ AgentCore Memory │                               │
│                           │  (Conversation)  │                               │
│                           └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Direct Browser-to-AgentCore**: The UI connects directly to AgentCore, bypassing API Gateway's 30-second timeout. This enables long-running agent responses (60-90 seconds).

2. **JWT Authentication**: Uses Cognito JWT tokens validated directly by AgentCore's built-in JWT authorizer. No Lambda proxy needed.

3. **AG-UI Protocol**: Real-time streaming using Server-Sent Events with structured events for text, tool calls, and results.

---

## Infrastructure (Terraform)

The infrastructure is defined in `/terraform/` using modular Terraform configurations.

### Directory Structure

```
terraform/
├── main.tf              # Root module - orchestrates all resources
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── backend.tf           # S3 backend configuration
├── ecr.tf               # ECR repository for agent images
├── versions.tf          # Provider versions
└── modules/
    ├── agent/           # AgentCore runtime module
    │   ├── main.tf      # Runtime, Memory, Endpoints
    │   ├── iam.tf       # IAM roles and policies
    │   ├── variables.tf
    │   └── outputs.tf
    ├── ui/              # Frontend infrastructure
    │   ├── main.tf      # S3, CloudFront, API Gateway
    │   └── ...
    ├── gateway/         # API Gateway (legacy invoke)
    │   └── ...
    └── mcp-server/      # MCP tools Lambda
        └── ...
```

### Core Resources

#### 1. Agent Runtime (`modules/agent/main.tf`)

```hcl
resource "aws_bedrockagentcore_agent_runtime" "this" {
  agent_runtime_name = var.name
  description        = var.description
  role_arn           = aws_iam_role.runtime.arn

  # Container image from ECR
  agent_runtime_artifact {
    container_configuration {
      container_uri = var.ecr_image_uri
    }
  }

  # Network: PUBLIC allows direct internet access
  network_configuration {
    network_mode = "PUBLIC"
  }

  # JWT Authorization for browser access
  dynamic "authorizer_configuration" {
    for_each = var.cognito_user_pool_id != "" ? [1] : []
    content {
      custom_jwt_authorizer {
        discovery_url   = "https://cognito-idp.${region}.amazonaws.com/${var.cognito_user_pool_id}/.well-known/openid-configuration"
        allowed_clients = var.cognito_client_ids
      }
    }
  }

  # Environment variables for the agent
  environment_variables = {
    AWS_REGION = local.region
    MEMORY_ID  = aws_bedrockagentcore_memory.this.id
    MODEL      = var.model
  }
}
```

#### 2. AgentCore Memory

```hcl
resource "aws_bedrockagentcore_memory" "this" {
  name              = "${var.name}_memory"
  description       = "Conversation memory for ${var.name}"
  encryption_type   = "SERVICE_MANAGED_KEY"
  memory_type       = "LONG_TERM"
  event_expiry_days = 30

  memory_strategies {
    semantic_memory_strategy {
      model       = "anthropic.claude-3-sonnet-20240229-v1:0"
      name        = "semantic"
      namespace   = var.name
      description = "Semantic memory for conversations"
    }
  }
}
```

#### 3. Runtime Endpoints (dev/canary/prod)

```hcl
resource "aws_bedrockagentcore_runtime_endpoint" "endpoints" {
  for_each         = toset(["dev", "canary", "prod"])
  name             = each.key
  runtime_id       = aws_bedrockagentcore_agent_runtime.this.id
  runtime_version  = "DEFAULT"
  description      = "${each.key} endpoint for ${var.name}"
}
```

### Cognito Authentication (`main.tf`)

```hcl
# User Pool
resource "aws_cognito_user_pool" "main" {
  name = "agent-ui-tf-${local.account_id}"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }
}

# User Pool Client (for PKCE flow)
resource "aws_cognito_user_pool_client" "main" {
  name         = "agent-ui-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false  # Required for PKCE

  allowed_oauth_flows = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes = ["openid", "email", "profile"]

  callback_urls = [
    "https://${module.ui[0].cloudfront_domain_name}/callback",
    "http://localhost:5173/callback"
  ]
  logout_urls = [
    "https://${module.ui[0].cloudfront_domain_name}",
    "http://localhost:5173"
  ]

  supported_identity_providers = ["COGNITO"]

  # Token validity
  access_token_validity  = 1   # 1 hour
  id_token_validity      = 1   # 1 hour
  refresh_token_validity = 30  # 30 days
}

# Hosted UI Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "agent-ui-tf-${local.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}
```

### ECR Repository (`ecr.tf`)

```hcl
resource "aws_ecr_repository" "agent" {
  name                 = "iker-agents/dsp-agent"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}
```

---

## Authentication Flow

The system uses **OAuth 2.0 Authorization Code Flow with PKCE** for browser authentication.

### Sequence Diagram

```
┌────────┐         ┌─────────────┐         ┌──────────────┐         ┌───────────┐
│ Browser│         │  Cognito    │         │  AgentCore   │         │   Agent   │
└───┬────┘         └──────┬──────┘         └──────┬───────┘         └─────┬─────┘
    │                     │                       │                       │
    │  1. Click "Sign In" │                       │                       │
    ├────────────────────▶│                       │                       │
    │                     │                       │                       │
    │  2. Redirect to     │                       │                       │
    │     Hosted UI       │                       │                       │
    │◀────────────────────┤                       │                       │
    │                     │                       │                       │
    │  3. Enter creds     │                       │                       │
    ├────────────────────▶│                       │                       │
    │                     │                       │                       │
    │  4. Redirect with   │                       │                       │
    │     auth code       │                       │                       │
    │◀────────────────────┤                       │                       │
    │                     │                       │                       │
    │  5. Exchange code   │                       │                       │
    │     for tokens      │                       │                       │
    │     (PKCE verifier) │                       │                       │
    ├────────────────────▶│                       │                       │
    │                     │                       │                       │
    │  6. Return JWT      │                       │                       │
    │     access_token    │                       │                       │
    │◀────────────────────┤                       │                       │
    │                     │                       │                       │
    │  7. POST /invocations                       │                       │
    │     Authorization: Bearer <JWT>             │                       │
    ├────────────────────────────────────────────▶│                       │
    │                     │                       │                       │
    │                     │  8. Validate JWT      │                       │
    │                     │     (OIDC discovery)  │                       │
    │                     │◀──────────────────────┤                       │
    │                     │                       │                       │
    │                     │  9. JWT valid         │                       │
    │                     │────────────────────▶  │                       │
    │                     │                       │                       │
    │                     │                       │  10. Invoke agent     │
    │                     │                       ├──────────────────────▶│
    │                     │                       │                       │
    │  11. AG-UI Stream (SSE)                     │◀──────────────────────┤
    │◀────────────────────────────────────────────┤                       │
    │                     │                       │                       │
```

### Frontend Auth Implementation (`ui/src/services/auth.ts`)

```typescript
// PKCE Code Verifier generation
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

// Initiate login
export function login(): void {
  const codeVerifier = generateCodeVerifier();
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);

  const codeChallenge = await sha256(codeVerifier);

  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: `${window.location.origin}/callback`,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params}`;
}

// Handle callback - exchange code for tokens
export async function handleCallback(code: string): Promise<void> {
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

  const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: COGNITO_CLIENT_ID,
      code,
      redirect_uri: `${window.location.origin}/callback`,
      code_verifier: codeVerifier,
    }),
  });

  const tokens = await response.json();
  // Store tokens securely
  sessionStorage.setItem('access_token', tokens.access_token);
  sessionStorage.setItem('refresh_token', tokens.refresh_token);
}
```

### AgentCore JWT Validation

AgentCore validates JWTs using the OIDC discovery endpoint:

```
Discovery URL: https://cognito-idp.us-east-1.amazonaws.com/{user_pool_id}/.well-known/openid-configuration
```

The JWT is validated for:
- Signature (using Cognito's public keys from JWKS)
- Expiration (`exp` claim)
- Audience (`aud` must match `allowed_clients`)
- Issuer (`iss` must match Cognito User Pool)

---

## Agent Runtime

### Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Agent Container (ARM64)                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BedrockAgentCoreApp                     │   │
│  │                                                      │   │
│  │  @app.entrypoint                                     │   │
│  │  async def invoke(payload, context):                 │   │
│  │      agent = create_agent(memory_id, session_id)     │   │
│  │      return handle_agent_response(agent, input)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│              ┌─────────────┴─────────────┐                 │
│              ▼                           ▼                 │
│  ┌──────────────────┐       ┌──────────────────┐          │
│  │   Yahoo DSP      │       │   Strands Agent   │          │
│  │   Agent SDK      │       │   Framework       │          │
│  │                  │       │                   │          │
│  │  - Agent class   │       │  - Tool execution │          │
│  │  - AG-UI bridge  │       │  - Memory mgmt    │          │
│  │  - Response hdlr │       │  - LLM streaming  │          │
│  └──────────────────┘       └──────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent Entry Point (`agents/dsp/main.py`)

```python
from bedrock_agentcore_runtime.app import BedrockAgentCoreApp
from yahoo_dsp_agent_sdk import handle_agent_response
from .agent import create_agent

app = BedrockAgentCoreApp()

@app.entrypoint
async def invoke(payload: dict, context: dict):
    """Main entry point for AgentCore invocations."""
    session_id = context.get("sessionId", "default")
    user_id = payload.get("user_id", "default")
    message = payload.get("input", "")
    stream_agui = payload.get("stream_agui", False)

    agent = create_agent(
        memory_id=os.environ.get("MEMORY_ID"),
        session_id=session_id,
    )

    return await handle_agent_response(
        agent=agent,
        message=message,
        user_id=user_id,
        session_id=session_id,
        stream_agui=stream_agui,
        agentcore_mode=True,
    )
```

---

## Streaming Protocol (AG-UI)

The system uses the **AG-UI (Agent-UI) Protocol** for real-time streaming.

### Event Types

| Event | Description | Key Fields |
|-------|-------------|------------|
| `RUN_STARTED` | Agent run begins | `threadId`, `runId` |
| `TEXT_MESSAGE_START` | New message begins | `messageId`, `role` |
| `TEXT_MESSAGE_CONTENT` | Token streaming (LLM output) | `messageId`, `delta` |
| `TEXT_MESSAGE_END` | Message complete | `messageId` |
| `TOOL_CALL_START` | Tool invocation begins | `toolCallId`, `toolCallName` |
| `TOOL_CALL_ARGS` | Tool arguments streaming | `toolCallId`, `delta` |
| `TOOL_CALL_RESULT` | Tool execution result | `toolCallId`, `content` |
| `TOOL_CALL_END` | Tool invocation complete | `toolCallId` |
| `RUN_FINISHED` | Agent run complete | `threadId`, `runId` |
| `RUN_ERROR` | Error occurred | `message` |

### SSE Format

```
data: {"type":"RUN_STARTED","threadId":"session-abc123","runId":"session-abc123_user1"}

data: {"type":"TEXT_MESSAGE_START","messageId":"msg-1","role":"assistant"}

data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"I'll "}

data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"check "}

data: {"type":"TOOL_CALL_START","toolCallId":"tc-1","toolCallName":"get_analytics"}

data: {"type":"TOOL_CALL_ARGS","toolCallId":"tc-1","delta":"{\"metric\":\"dau\"}"}

data: {"type":"TOOL_CALL_RESULT","toolCallId":"tc-1","content":"{\"dau\":1250}"}

data: {"type":"TOOL_CALL_END","toolCallId":"tc-1"}

data: {"type":"TEXT_MESSAGE_CONTENT","messageId":"msg-1","delta":"The DAU is 1,250."}

data: {"type":"TEXT_MESSAGE_END","messageId":"msg-1"}

data: {"type":"RUN_FINISHED","threadId":"session-abc123","runId":"session-abc123_user1"}
```

### AG-UI Bridge (`agent-sdk/src/yahoo_dsp_agent_sdk/agui_bridge.py`)

Converts Strands agent events to AG-UI protocol:

```python
class StrandsToAGUIBridge:
    def convert_strands_event(self, strands_event: Dict) -> List[Any]:
        # Handle tool result from Strands
        if strands_event.get("type") == "tool_result":
            tool_result = strands_event.get("tool_result", {})
            content = extract_tool_result_text(tool_result)
            return [self.end_tool_call(content)]

        # Handle LLM streaming events
        if "data" in strands_event and "delta" in strands_event:
            return [self.add_text_content(strands_event["data"])]

        # Handle tool call start/args
        if "contentBlockStart" in event_data:
            if "toolUse" in start_data:
                return [self.start_tool_call(tool_name)]
```

---

## Frontend Architecture

### Technology Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** + **shadcn/ui** for styling
- **React Router** for navigation

### Key Components

```
ui/src/
├── services/
│   ├── auth.ts       # Cognito OAuth/PKCE implementation
│   └── api.ts        # AgentCore streaming client
├── pages/
│   └── Chat.tsx      # Main chat page with streaming
├── components/
│   └── agents/
│       ├── ChatInterface.tsx  # Message display
│       └── ToolCallBox.tsx    # Tool call visualization
└── types/
    └── agent.ts      # TypeScript types
```

### Direct AgentCore Invocation (`ui/src/services/api.ts`)

```typescript
export async function invokeAgentDirect(
  input: string,
  sessionId: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const token = await getAccessToken();
  const escapedArn = encodeURIComponent(RUNTIME_ARN);

  const response = await fetch(
    `${AGENTCORE_ENDPOINT}/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
      },
      body: JSON.stringify({ input, stream_agui: true }),
    }
  );

  // Parse SSE stream
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const eventStr of events) {
      const dataMatch = eventStr.match(/^data:\s*(.+)$/m);
      if (dataMatch) {
        const event = JSON.parse(dataMatch[1]);
        handleAGUIEvent(event, callbacks);
      }
    }
  }
}
```

### Environment Variables

```bash
# UI Environment (.env)
VITE_COGNITO_DOMAIN=https://agent-ui-tf-xxx.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=xxx
VITE_AGENTCORE_ENDPOINT=https://bedrock-agentcore.us-east-1.amazonaws.com
VITE_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-east-1:xxx:runtime/dsp_agent_tf-xxx
```

---

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.0
3. Docker with buildx support
4. Node.js/Bun for frontend

### Deploy Steps

```bash
# 1. Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker buildx build --platform linux/arm64 -t <account>.dkr.ecr.us-east-1.amazonaws.com/iker-agents/dsp-agent:latest --push .

# 2. Deploy infrastructure
cd terraform
terraform init
terraform apply

# 3. Build and deploy UI
cd ui
bun install
bun run build
aws s3 sync dist/ s3://<ui-bucket> --delete
aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*"
```

### Outputs

After deployment, Terraform outputs:

```
ui_url                = "https://d14djisl5rxgcm.cloudfront.net"
cognito_domain        = "https://agent-ui-tf-xxx.auth.us-east-1.amazoncognito.com"
dsp_agent_runtime_arn = "arn:aws:bedrock-agentcore:us-east-1:xxx:runtime/dsp_agent_tf-xxx"
```

---

## Security Considerations

1. **No secrets in browser**: All sensitive operations use JWT tokens, never API keys
2. **PKCE flow**: Prevents authorization code interception attacks
3. **Short-lived tokens**: Access tokens expire in 1 hour
4. **CORS**: AgentCore handles CORS for browser requests
5. **Network isolation**: Agent runtime uses PUBLIC network mode for direct access

---

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check JWT token expiration, refresh if needed
2. **CORS errors**: Ensure `allowed_clients` in authorizer config includes your Cognito client ID
3. **Timeout**: Direct AgentCore connection should not timeout; check network connectivity
4. **Tool results showing "Tool executed successfully"**: Backend AG-UI bridge not capturing Strands tool results

### Debug Logging

Enable browser console debug logging to see AG-UI events:
```javascript
console.debug('[AG-UI Event]', event.type, event);
```

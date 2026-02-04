# MCP Agent Bridge

Exposes your AI agents as MCP tools, allowing coding assistants (Claude Code, Cursor, Windsurf, etc.) to communicate with them.

## How It Works

```
┌──────────────────┐         MCP          ┌─────────────────┐
│  Claude Code     │ ◄──────────────────► │  MCP Bridge     │
│  Cursor          │     JSON-RPC         │                 │
│  Windsurf        │                      │  ┌───────────┐  │
└──────────────────┘                      │  │ DSP Agent │  │
                                          │  ├───────────┤  │
                                          │  │ Research  │  │
                                          │  ├───────────┤  │
                                          │  │ Coding    │  │
                                          │  └───────────┘  │
                                          └─────────────────┘
```

## Setup

### 1. Start Your Agents

```bash
# Start all agents locally
make local

# Or start specific agent
make local-agent AGENT=dsp
```

### 2. Configure Your Coding Assistant

#### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "agent-bridge": {
      "command": "python",
      "args": ["/path/to/iker-agents/agents/mcp-agent-bridge/server.py"],
      "env": {
        "DSP_AGENT_URL": "http://localhost:8080",
        "RESEARCH_AGENT_URL": "http://localhost:8081",
        "CODING_AGENT_URL": "http://localhost:8082"
      }
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "agent-bridge": {
      "command": "python",
      "args": ["agents/mcp-agent-bridge/server.py"],
      "env": {
        "DSP_AGENT_URL": "http://localhost:8080"
      }
    }
  }
}
```

#### VS Code + Continue

Add to `.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "python",
          "args": ["agents/mcp-agent-bridge/server.py"]
        }
      }
    ]
  }
}
```

### 3. Connect to Deployed Agents (AWS)

For production agents running on AWS AgentCore:

```json
{
  "mcpServers": {
    "agent-bridge": {
      "command": "python",
      "args": ["agents/mcp-agent-bridge/server.py"],
      "env": {
        "DSP_AGENT_URL": "https://your-api-gateway-url.amazonaws.com/dev",
        "AWS_PROFILE": "your-aws-profile"
      }
    }
  }
}
```

## Available Tools

Once configured, your coding assistant will have these tools:

| Tool | Description |
|------|-------------|
| `list_agents` | List all available agents |
| `message_agent` | Send a message to any agent |
| `ask_dsp_agent` | Quick access to DSP business agent |
| `ask_research_agent` | Quick access to research agent |
| `ask_coding_agent` | Quick access to coding agent |

## Example Usage

In Claude Code or Cursor, you can now say:

- "Ask the DSP agent how many customers we have"
- "Use the research agent to find information about competitor pricing"
- "Have the coding agent review this function for bugs"
- "Message the dsp agent: What's our monthly revenue?"

## Development

```bash
# Install dependencies
cd agents/mcp-agent-bridge
pip install mcp httpx uvicorn

# Run server directly
python server.py

# Test with MCP inspector
npx @modelcontextprotocol/inspector python server.py
```

## A2A vs MCP

This bridge exists because:

- **A2A** (Agent-to-Agent): Protocol for agents to communicate with each other (used internally between your agents)
- **MCP** (Model Context Protocol): Protocol for LLM applications to access tools (used by coding assistants)

Your agents speak A2A to each other, but coding assistants speak MCP. This bridge translates between the two worlds.

# PR #7 Session Report: Proper MCP Server Deployment & Multi-Agent Setup

## Overview

This session focused on implementing proper MCP Server deployment, enabling all 3 agents (DSP, Research, Coding), fixing UI agent selection, and replacing `python_repl` with AWS AgentCore Code Interpreter.

## Changes Made

### 1. Multi-Agent Deployment

**Problem:** Only DSP Agent was deployed, Research and Coding agents weren't in Terraform.

**Solution:**
- Added ECR repositories for `research-agent` and `coding-agent` in `terraform/ecr.tf`
- Added `research_agent` and `coding_agent` modules in `terraform/main.tf`
- Added variables: `deploy_research_agent`, `deploy_coding_agent`, image tags
- Updated CI/CD to build all 3 agents in parallel

**Files Changed:**
- `terraform/ecr.tf` - Added ECR repos
- `terraform/main.tf` - Added agent modules
- `terraform/variables.tf` - Added deployment flags and image tags
- `terraform/outputs.tf` - Added outputs for new agents
- `.github/workflows/terraform-merge.yml` - Added build jobs for all agents
- `.github/workflows/terraform-pr.yml` - Added build jobs for all agents

### 2. UI Agent Selection Fix

**Problem:** UI used hardcoded `VITE_RUNTIME_ARN` for all agents, so all agents responded as "business analyst".

**Solution:**
- Made `invokeAgentDirect()` accept optional `runtimeArn` parameter
- Chat.tsx now gets selected agent's `runtime_arn` and passes it
- Added `runtime_arn` to UI's `Agent` type interface

**Files Changed:**
- `ui/src/services/api.ts` - Added `runtimeArn` parameter to `invokeAgentDirect()`
- `ui/src/pages/Chat.tsx` - Pass selected agent's runtime ARN
- `ui/src/types/agent.ts` - Added `runtime_arn` field to Agent interface
- `ui/src/hooks/useAgents.ts` - Include `runtime_arn` in agent mapping

### 3. Coding Agent - python_repl Issues

**Problem:** `python_repl` from `strands_tools` failed in serverless with multiple issues:

1. **Permission denied:** Tried to create `/app/repl_state` directory
   - Fix: Set `PYTHON_REPL_PERSISTENCE_DIR=/tmp/repl_state` and create dir in Dockerfile

2. **Consent prompt:** Required user confirmation before executing code
   - Fix: Set `BYPASS_TOOL_CONSENT=true`

3. **PTY failure:** Pseudo-terminal doesn't work in serverless containers
   - Error: `Error reading from PTY: [Errno 5] Input/output error`
   - Fix: Set `PYTHON_REPL_INTERACTIVE=false` for standard mode

**Root Cause:** `python_repl` was designed for interactive local development, not serverless.

### 4. AgentCore Code Interpreter (Final Solution)

**Problem:** Even with all workarounds, `python_repl` was hacky and unreliable.

**Solution:** Replace with AWS AgentCore Code Interpreter - a fully managed service.

**Benefits:**
- Fully managed sandbox environment
- No PTY/container issues
- Supports Python, JavaScript, TypeScript
- Up to 8 hours execution time
- File support up to 5GB via S3
- Secure isolation

**Implementation:**
- Created `terraform/modules/code-interpreter/` module
- IAM role with code execution permissions
- Updated `agents/coding/agent.py` to use `AgentCoreCodeInterpreter`
- Removed all `python_repl` workarounds from Terraform

**Files Changed:**
- `terraform/modules/code-interpreter/main.tf` - Code Interpreter resource
- `terraform/modules/code-interpreter/variables.tf` - Variables
- `terraform/modules/code-interpreter/outputs.tf` - Outputs
- `terraform/modules/agent/iam.tf` - Added Code Interpreter IAM policy
- `terraform/modules/agent/variables.tf` - Added code interpreter variables
- `terraform/main.tf` - Added code_interpreter module, updated coding_agent
- `agents/coding/agent.py` - Use `AgentCoreCodeInterpreter` instead of `python_repl`

### 5. CI/CD Pipeline Updates

**Changes:**
- Added `ensure-ecr-repos` job to create ECR repos before builds
- Added parallel build jobs for all 3 agents + MCP server
- Updated Terraform deploy to pass all image tags
- Updated promote jobs to promote all 3 agents

### 6. Documentation

- Updated `ARCHITECTURE.md` with:
  - All 3 agents with their tools
  - UI agent selection flow
  - Code Interpreter documentation
  - Troubleshooting section
  - Updated CI/CD diagrams

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI (React)                               │
│  - Agent selector dropdown                                       │
│  - Passes selected agent's runtime_arn to invokeAgentDirect()   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Bedrock AgentCore                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ DSP Agent   │  │  Research   │  │   Coding    │              │
│  │             │  │   Agent     │  │    Agent    │              │
│  │ MCP Tools   │  │ calculator  │  │ calculator  │              │
│  │             │  │ http_request│  │ CodeInterp  │              │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘              │
│         │                                  │                     │
│         ▼                                  ▼                     │
│  ┌─────────────┐                   ┌─────────────┐              │
│  │ MCP Server  │                   │    Code     │              │
│  │ (Runtime)   │                   │ Interpreter │              │
│  └─────────────┘                   │  (Managed)  │              │
│                                    └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Commits in PR #7

1. `Fix agent selection to use correct runtime ARN`
2. `Add runtime_arn to UI Agent type for direct invocation`
3. `Fix coding agent: set PYTHON_REPL_PERSISTENCE_DIR to writable /tmp`
4. `Fix coding agent: create /tmp/repl_state in Dockerfile`
5. `Fix coding agent: bypass tool consent prompt for serverless`
6. `Fix coding agent: disable PTY mode for python_repl`
7. `Update ARCHITECTURE.md with all agents and troubleshooting`
8. `Replace python_repl with AWS AgentCore Code Interpreter`
9. `Remove legacy CDK-based pr.yml workflow`

## Known Issues

~~1. **`full-preview` job failing:** The `pr.yml` workflow has an old CDK-based `full-preview` job that expects `ui/dist` but doesn't build it.~~ **RESOLVED:** Removed legacy `pr.yml` workflow.

## Completed Actions

1. ✅ Removed legacy CDK-based `pr.yml` workflow (was causing `full-preview` failures)
2. ✅ Now using only `terraform-pr.yml` for PR validation

## Next Steps

1. Merge PR #7 after CI passes
2. Test all 3 agents in production UI
3. Verify Code Interpreter works correctly for Coding Agent

## Resources

- [AWS AgentCore Code Interpreter Docs](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-tool.html)
- [Strands Code Interpreter Integration](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-using-strands.html)
- [AgentCore Terraform Module](https://github.com/aws-ia/terraform-aws-agentcore)

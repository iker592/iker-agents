export type AgentStatus = "active" | "idle" | "error" | "stopped"

export type AgentType = "research" | "coding" | "analyst" | "custom"

export interface AgentTool {
  name: string
  description: string
  enabled: boolean
}

export interface AgentSession {
  id: string
  agentId: string
  startedAt: Date
  endedAt?: Date
  messageCount: number
  status: "active" | "completed" | "error"
}

export interface AgentMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: Date
  toolName?: string
  toolResult?: string
}

export interface AgentMetrics {
  totalSessions: number
  totalMessages: number
  avgResponseTime: number
  successRate: number
  tokensUsed: number
}

export interface Agent {
  id: string
  name: string
  type: AgentType
  description: string
  status: AgentStatus
  model: string
  systemPrompt: string
  tools: AgentTool[]
  metrics: AgentMetrics
  createdAt: Date
  lastActiveAt: Date
}

export interface ThoughtLogEntry {
  id: string
  timestamp: Date
  type: "thinking" | "tool_call" | "tool_result" | "decision"
  content: string
  metadata?: Record<string, unknown>
}

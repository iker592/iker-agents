import type { Agent, AgentSession, AgentMessage, ThoughtLogEntry } from "@/types/agent"

export const mockAgents: Agent[] = [
  {
    id: "research-agent",
    name: "Research Agent",
    type: "research",
    description: "Specialized in gathering information, analyzing data, and providing well-researched insights.",
    status: "active",
    model: "claude-3-5-haiku",
    systemPrompt: "You are a Research Agent specialized in gathering information, analyzing data, and providing well-researched insights. You can perform calculations and make HTTP requests to gather information. Be thorough and cite your reasoning.",
    tools: [
      { name: "calculator", description: "Perform mathematical calculations", enabled: true },
      { name: "http_request", description: "Make HTTP requests to gather data", enabled: true },
    ],
    metrics: {
      totalSessions: 156,
      totalMessages: 1423,
      avgResponseTime: 2.3,
      successRate: 98.2,
      tokensUsed: 892341,
    },
    createdAt: new Date("2024-12-01"),
    lastActiveAt: new Date(),
  },
  {
    id: "coding-agent",
    name: "Coding Agent",
    type: "coding",
    description: "Specialized in writing Python code, debugging, and solving programming problems.",
    status: "idle",
    model: "claude-3-5-haiku",
    systemPrompt: "You are a Coding Agent specialized in writing Python code, debugging, and solving programming problems. You can execute Python code to verify your solutions. Write clean, well-documented code and explain your approach.",
    tools: [
      { name: "calculator", description: "Perform mathematical calculations", enabled: true },
      { name: "python_repl", description: "Execute Python code", enabled: true },
    ],
    metrics: {
      totalSessions: 89,
      totalMessages: 567,
      avgResponseTime: 3.1,
      successRate: 95.6,
      tokensUsed: 456123,
    },
    createdAt: new Date("2024-12-05"),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "analyst-agent",
    name: "Data Analyst Agent",
    type: "analyst",
    description: "Helps users analyze data, perform calculations, and provide insights.",
    status: "active",
    model: "claude-3-5-haiku",
    systemPrompt: "You are a data analyst. You help users analyze data, perform calculations, and provide insights. Be precise and concise in your responses.",
    tools: [
      { name: "calculator", description: "Perform mathematical calculations", enabled: true },
    ],
    metrics: {
      totalSessions: 234,
      totalMessages: 2156,
      avgResponseTime: 1.8,
      successRate: 99.1,
      tokensUsed: 1234567,
    },
    createdAt: new Date("2024-11-15"),
    lastActiveAt: new Date(Date.now() - 1000 * 60 * 5),
  },
]

export const mockSessions: AgentSession[] = [
  {
    id: "session-1",
    agentId: "research-agent",
    startedAt: new Date(Date.now() - 1000 * 60 * 15),
    messageCount: 8,
    status: "active",
  },
  {
    id: "session-2",
    agentId: "research-agent",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    endedAt: new Date(Date.now() - 1000 * 60 * 60),
    messageCount: 24,
    status: "completed",
  },
  {
    id: "session-3",
    agentId: "coding-agent",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    endedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    messageCount: 15,
    status: "completed",
  },
  {
    id: "session-4",
    agentId: "analyst-agent",
    startedAt: new Date(Date.now() - 1000 * 60 * 5),
    messageCount: 4,
    status: "active",
  },
]

export const mockMessages: AgentMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "What is 15 * 3?",
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
  },
  {
    id: "msg-2",
    role: "tool",
    content: "Calculating 15 * 3...",
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
    toolName: "calculator",
    toolResult: "45",
  },
  {
    id: "msg-3",
    role: "assistant",
    content: "The result of 15 * 3 is **45**.",
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
  },
  {
    id: "msg-4",
    role: "user",
    content: "What is 25% of 200?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "msg-5",
    role: "tool",
    content: "Calculating 25% of 200...",
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
    toolName: "calculator",
    toolResult: "50",
  },
  {
    id: "msg-6",
    role: "assistant",
    content: "25% of 200 is **50**.\n\nI calculated this by multiplying 200 by 0.25 (which is 25/100).",
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
  },
]

export const mockThoughtLog: ThoughtLogEntry[] = [
  {
    id: "thought-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
    type: "thinking",
    content: "User wants to calculate 15 * 3. I should use the calculator tool for accuracy.",
  },
  {
    id: "thought-2",
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
    type: "tool_call",
    content: "Calling calculator tool with expression: 15 * 3",
    metadata: { tool: "calculator", input: "15 * 3" },
  },
  {
    id: "thought-3",
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
    type: "tool_result",
    content: "Calculator returned: 45",
    metadata: { tool: "calculator", output: "45" },
  },
  {
    id: "thought-4",
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
    type: "decision",
    content: "Formatting the result in a clear, concise manner for the user.",
  },
]

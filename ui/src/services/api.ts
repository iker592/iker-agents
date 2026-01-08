/**
 * API service for connecting to the agent backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Agent {
  id: string;
  name: string;
  runtime_arn: string;
  status: string;
}

export interface InvokeRequest {
  agent_id: string;
  input: string;
  session_id?: string;
  user_id?: string;
}

export interface InvokeResponse {
  output: string;
  session_id: string;
}

/**
 * Fetch all available agents
 */
export async function getAgents(): Promise<Agent[]> {
  const response = await fetch(`${API_BASE_URL}/agents`);

  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.statusText}`);
  }

  const data = await response.json();
  return data.agents || [];
}

/**
 * Invoke an agent with a prompt
 */
export async function invokeAgent(request: InvokeRequest): Promise<InvokeResponse> {
  const response = await fetch(`${API_BASE_URL}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Failed to invoke agent');
  }

  return response.json();
}

/**
 * Generate a unique session ID (minimum 33 chars required by AWS)
 */
export function generateSessionId(): string {
  // Generate crypto-random UUID (32 hex chars) with 'session-' prefix = 40 chars total
  return `session-${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Session storage management
 */
const SESSIONS_STORAGE_KEY = 'agent-sessions';
const MESSAGES_STORAGE_KEY = 'agent-messages';

export interface StoredSession {
  id: string;
  agentId: string;
  startedAt: string;
  lastActivity: string;
  messageCount: number;
  status: 'active' | 'completed' | 'error';
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolName?: string;
  toolResult?: string;
}

export function saveSession(session: StoredSession): void {
  const sessions = loadSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }

  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
}

export function loadSessions(): StoredSession[] {
  const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveMessages(sessionId: string, messages: StoredMessage[]): void {
  const allMessages = loadAllMessages();
  allMessages[sessionId] = messages;
  localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(allMessages));
}

export function loadAllMessages(): Record<string, StoredMessage[]> {
  const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export function loadSessionMessages(sessionId: string): StoredMessage[] {
  const allMessages = loadAllMessages();
  return allMessages[sessionId] || [];
}

export function getAgentSessions(agentId: string): StoredSession[] {
  const sessions = loadSessions();
  return sessions
    .filter(s => s.agentId === agentId)
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}

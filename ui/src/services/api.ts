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

export function saveSessions(sessions: Record<string, { agentId: string; messageCount: number; startedAt: Date }>): void {
  const storedSessions: StoredSession[] = Object.entries(sessions).map(([sessionId, data]) => ({
    id: sessionId,
    agentId: data.agentId,
    startedAt: data.startedAt.toISOString(),
    lastActivity: new Date().toISOString(),
    messageCount: data.messageCount,
    status: 'active' as const,
  }));

  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(storedSessions));
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

export function saveMessages(agentId: string, messages: StoredMessage[]): void {
  const allMessages = loadAllMessages();
  allMessages[agentId] = messages;
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

export function loadAgentSession(agentId: string): { sessionId: string; startedAt: Date } | null {
  const sessions = loadSessions();
  const session = sessions.find(s => s.agentId === agentId && s.status === 'active');
  if (!session) return null;

  return {
    sessionId: session.id,
    startedAt: new Date(session.startedAt)
  };
}

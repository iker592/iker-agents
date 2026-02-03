/**
 * API service for connecting to the agent backend
 */

import { getAccessToken, isAuthConfigured } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Direct AgentCore connection (bypasses API Gateway 30s timeout)
const AGENTCORE_ENDPOINT = import.meta.env.VITE_AGENTCORE_ENDPOINT || 'https://bedrock-agentcore.us-east-1.amazonaws.com';
const RUNTIME_ARN = import.meta.env.VITE_RUNTIME_ARN || '';

// ============================================================================
// AG-UI Protocol Types (from agent-sdk/src/yahoo_dsp_agent_sdk/agui_bridge.py)
// ============================================================================

/**
 * AG-UI event types - all events from ag_ui.core.events
 */
export type AGUIEventType =
  | 'RUN_STARTED'          // Run begins - has thread_id, run_id
  | 'RUN_FINISHED'         // Run completes - has thread_id, run_id
  | 'RUN_ERROR'            // Error occurred - has message
  | 'TEXT_MESSAGE_START'   // Text message begins - has message_id, role
  | 'TEXT_MESSAGE_CONTENT' // Text delta (token streaming) - has message_id, delta
  | 'TEXT_MESSAGE_END'     // Text message ends - has message_id
  | 'TOOL_CALL_START'      // Tool call begins - has tool_call_id, tool_call_name
  | 'TOOL_CALL_ARGS'       // Tool arguments delta - has tool_call_id, delta
  | 'TOOL_CALL_RESULT'     // Tool result - has tool_call_id, content
  | 'TOOL_CALL_END';       // Tool call ends - has tool_call_id

/**
 * AG-UI event structure
 * Note: Backend sends camelCase fields, but we support both for compatibility
 */
export interface AGUIEvent {
  type: AGUIEventType;
  // Run events (camelCase from backend)
  threadId?: string;
  runId?: string;
  // Legacy snake_case support
  thread_id?: string;
  run_id?: string;
  // Message events (camelCase from backend)
  messageId?: string;
  role?: string;
  delta?: string;          // For TEXT_MESSAGE_CONTENT and TOOL_CALL_ARGS
  // Legacy snake_case support
  message_id?: string;
  // Tool events (camelCase from backend)
  toolCallId?: string;
  toolCallName?: string;
  parentMessageId?: string;
  content?: string;        // For TOOL_CALL_RESULT
  // Legacy snake_case support
  tool_call_id?: string;
  tool_call_name?: string;
  parent_message_id?: string;
  // Error
  message?: string;        // For RUN_ERROR
}

/**
 * Callbacks for streaming AG-UI events
 */
export interface StreamCallbacks {
  // Run lifecycle
  onRunStart?: (threadId: string, runId: string) => void;
  onRunFinish?: () => void;
  onError?: (error: string) => void;
  // Text streaming (token by token from LLM)
  onMessageStart?: (messageId: string) => void;
  onTextDelta: (delta: string) => void;  // Main streaming event - LLM tokens
  onMessageEnd?: () => void;
  // Tool calls
  onToolStart?: (toolName: string, toolCallId: string) => void;
  onToolArgsDelta?: (delta: string) => void;  // Streaming tool arguments
  onToolResult?: (result: string) => void;
  onToolEnd?: () => void;
}

/**
 * Check if direct AgentCore invocation is configured
 */
export function isDirectAgentCoreConfigured(): boolean {
  return !!(RUNTIME_ARN && isAuthConfigured());
}

/**
 * Invoke agent directly via AgentCore with AG-UI streaming
 * Bypasses API Gateway 30s timeout - supports responses up to 5 minutes
 *
 * @param input - The user's message
 * @param sessionId - Session ID for conversation continuity
 * @param callbacks - Streaming callbacks for AG-UI events
 * @param runtimeArn - Optional runtime ARN (defaults to VITE_RUNTIME_ARN)
 */
export async function invokeAgentDirect(
  input: string,
  sessionId: string,
  callbacks: StreamCallbacks,
  runtimeArn?: string
): Promise<void> {
  const arn = runtimeArn || RUNTIME_ARN;
  if (!arn) {
    throw new Error('Runtime ARN not provided and VITE_RUNTIME_ARN not configured');
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const escapedArn = encodeURIComponent(arn);

  const response = await fetch(
    `${AGENTCORE_ENDPOINT}/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
      },
      // Use stream_agui for AG-UI protocol (structured events)
      body: JSON.stringify({ input, stream_agui: true }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AgentCore error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (separated by double newlines)
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // Keep incomplete event in buffer

      for (const eventStr of events) {
        if (!eventStr.trim()) continue;

        // Parse SSE format: "data: {...}"
        const dataMatch = eventStr.match(/^data:\s*(.+)$/m);
        if (!dataMatch) continue;

        try {
          const event: AGUIEvent = JSON.parse(dataMatch[1]);
          handleAGUIEvent(event, callbacks);
        } catch (parseError) {
          console.warn('Failed to parse AG-UI event:', dataMatch[1]);
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const dataMatch = buffer.match(/^data:\s*(.+)$/m);
      if (dataMatch) {
        try {
          const event: AGUIEvent = JSON.parse(dataMatch[1]);
          handleAGUIEvent(event, callbacks);
        } catch {
          // Ignore incomplete events at end
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Handle individual AG-UI events
 */
function handleAGUIEvent(event: AGUIEvent, callbacks: StreamCallbacks): void {
  // Debug logging for all events
  console.debug('[AG-UI Event]', event.type, event);

  switch (event.type) {
    // Run lifecycle
    case 'RUN_STARTED':
      // Prefer camelCase (from backend), fallback to snake_case
      callbacks.onRunStart?.(event.threadId || event.thread_id || '', event.runId || event.run_id || '');
      break;
    case 'RUN_FINISHED':
      callbacks.onRunFinish?.();
      break;
    case 'RUN_ERROR':
      callbacks.onError?.(event.message || 'Unknown error');
      break;

    // Text streaming (token by token from LLM)
    case 'TEXT_MESSAGE_START':
      callbacks.onMessageStart?.(event.messageId || event.message_id || '');
      break;
    case 'TEXT_MESSAGE_CONTENT':
      if (event.delta) {
        callbacks.onTextDelta(event.delta);
      }
      break;
    case 'TEXT_MESSAGE_END':
      callbacks.onMessageEnd?.();
      break;

    // Tool calls
    case 'TOOL_CALL_START':
      // Prefer camelCase (toolCallName from backend), fallback to snake_case
      const toolName = event.toolCallName || event.tool_call_name || 'unknown tool';
      const toolCallId = event.toolCallId || event.tool_call_id || '';
      console.log('[AG-UI] Tool call started:', toolName, 'id:', toolCallId);
      callbacks.onToolStart?.(toolName, toolCallId);
      break;
    case 'TOOL_CALL_ARGS':
      if (event.delta) {
        callbacks.onToolArgsDelta?.(event.delta);
      }
      break;
    case 'TOOL_CALL_RESULT':
      console.log('[AG-UI] Tool call result:', event.content?.substring(0, 100));
      callbacks.onToolResult?.(event.content || '');
      break;
    case 'TOOL_CALL_END':
      console.log('[AG-UI] Tool call ended');
      callbacks.onToolEnd?.();
      break;
  }
}

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
  // Build headers with optional auth token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add authorization header if auth is configured
  if (isAuthConfigured()) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}/invoke`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required. Please log in.');
    }
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

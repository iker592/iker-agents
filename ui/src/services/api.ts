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
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session-${crypto.randomUUID().replace(/-/g, '')}`;
}

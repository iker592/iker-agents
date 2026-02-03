import { useState, useEffect } from 'react';
import { getAgents, type Agent as APIAgent } from '@/services/api';
import type { Agent } from '@/types/agent';

/**
 * Hook to fetch and manage agents from the API
 */
export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        setLoading(true);
        setError(null);
        const apiAgents = await getAgents();

        // Map API agents to UI agent type
        const mappedAgents: Agent[] = apiAgents.map((apiAgent: APIAgent) => ({
          id: apiAgent.id,
          name: apiAgent.name,
          type: apiAgent.id as any, // Use id as type
          description: getAgentDescription(apiAgent.id),
          status: apiAgent.status as 'active' | 'idle' | 'error',
          model: 'claude-sonnet-4-5-20250929',
          systemPrompt: getAgentSystemPrompt(apiAgent.id),
          tools: getAgentTools(apiAgent.id),
          metrics: {
            totalSessions: 0,
            totalMessages: 0,
            avgResponseTime: 0,
            successRate: 100,
            tokensUsed: 0,
          },
          createdAt: new Date(),
          lastActiveAt: new Date(),
          runtime_arn: apiAgent.runtime_arn,  // Preserve for direct AgentCore invocation
        }));

        setAgents(mappedAgents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  return { agents, loading, error, refetch: () => {} };
}

function getAgentDescription(agentId: string): string {
  const descriptions: Record<string, string> = {
    dsp: 'Default agent for general-purpose tasks with calculator support.',
    research: 'Specialized in gathering information, analyzing data, and providing well-researched insights.',
    coding: 'Specialized in writing Python code, debugging, and solving programming problems.',
  };
  return descriptions[agentId] || 'General-purpose agent';
}

function getAgentSystemPrompt(agentId: string): string {
  const prompts: Record<string, string> = {
    dsp: 'You are a helpful assistant that can perform calculations and assist with various tasks.',
    research: 'You are a Research Agent specialized in gathering information, analyzing data, and providing well-researched insights. You can perform calculations and make HTTP requests to gather information. Be thorough and cite your reasoning.',
    coding: 'You are a Coding Agent specialized in writing Python code, debugging, and solving programming problems. You can execute Python code to verify your solutions. Write clean, well-documented code and explain your approach.',
  };
  return prompts[agentId] || 'You are a helpful assistant.';
}

function getAgentTools(agentId: string) {
  const tools: Record<string, Array<{ name: string; description: string; enabled: boolean }>> = {
    dsp: [
      { name: 'calculator', description: 'Perform mathematical calculations', enabled: true },
    ],
    research: [
      { name: 'calculator', description: 'Perform mathematical calculations', enabled: true },
      { name: 'http_request', description: 'Make HTTP requests to gather data', enabled: true },
    ],
    coding: [
      { name: 'calculator', description: 'Perform mathematical calculations', enabled: true },
      { name: 'python_repl', description: 'Execute Python code', enabled: true },
    ],
  };
  return tools[agentId] || [];
}

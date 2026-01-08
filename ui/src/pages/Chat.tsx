import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { Bot, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatInterface } from "@/components/agents/ChatInterface"
import { useAgents } from "@/hooks/useAgents"
import { invokeAgent, generateSessionId, saveSession, loadSessionMessages, saveMessages, getAgentSessions, type StoredMessage, type StoredSession } from "@/services/api"
import { cn } from "@/lib/utils"
import type { AgentMessage } from "@/types/agent"

const statusColors = {
  active: "success",
  idle: "secondary",
  error: "destructive",
  stopped: "outline",
} as const

const typeColors = {
  research: "bg-blue-500/10 text-blue-500",
  coding: "bg-purple-500/10 text-purple-500",
  analyst: "bg-green-500/10 text-green-500",
  custom: "bg-orange-500/10 text-orange-500",
}

export function Chat() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { agents, loading, error } = useAgents()
  const [selectedAgentId, setSelectedAgentId] = useState<string>("")
  const [currentSessionId, setCurrentSessionId] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Store messages by sessionId
  const [sessionMessages, setSessionMessages] = useState<Record<string, AgentMessage[]>>({})

  // Current session's messages
  const messages = sessionMessages[currentSessionId] || []

  // Load or create session when agent or session param changes
  useEffect(() => {
    if (!selectedAgentId) return

    const sessionParam = searchParams.get("session")

    if (sessionParam) {
      // Load specific session from URL
      const storedMessages = loadSessionMessages(sessionParam)
      const loadedMessages: AgentMessage[] = storedMessages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))

      setCurrentSessionId(sessionParam)
      setSessionMessages(prev => ({
        ...prev,
        [sessionParam]: loadedMessages
      }))
    } else {
      // Get or create latest session for this agent
      const agentSessions = getAgentSessions(selectedAgentId)

      if (agentSessions.length > 0 && agentSessions[0].status === 'active') {
        // Load most recent active session
        const latestSession = agentSessions[0]
        const storedMessages = loadSessionMessages(latestSession.id)
        const loadedMessages: AgentMessage[] = storedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))

        setCurrentSessionId(latestSession.id)
        setSessionMessages(prev => ({
          ...prev,
          [latestSession.id]: loadedMessages
        }))

        // Update URL to include session
        setSearchParams({ agent: selectedAgentId, session: latestSession.id })
      } else {
        // Create new session
        handleNewChat()
      }
    }
  }, [selectedAgentId, searchParams.get("session")])

  // Set initial agent from URL or first agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      const agentId = searchParams.get("agent") || agents[0].id
      setSelectedAgentId(agentId)
    }
  }, [agents, selectedAgentId, searchParams])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      const storedMessages: StoredMessage[] = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        toolName: msg.toolName,
        toolResult: msg.toolResult
      }))
      saveMessages(currentSessionId, storedMessages)

      // Update session metadata
      const session: StoredSession = {
        id: currentSessionId,
        agentId: selectedAgentId,
        startedAt: messages[0]?.timestamp.toISOString() || new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messageCount: messages.length,
        status: 'active'
      }
      saveSession(session)
    }
  }, [messages, currentSessionId, selectedAgentId])

  // Create new chat session
  const handleNewChat = () => {
    const newSessionId = generateSessionId()

    // Save empty session
    const newSession: StoredSession = {
      id: newSessionId,
      agentId: selectedAgentId,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0,
      status: 'active'
    }
    saveSession(newSession)

    // Update state
    setCurrentSessionId(newSessionId)
    setSessionMessages(prev => ({
      ...prev,
      [newSessionId]: []
    }))

    // Update URL
    setSearchParams({ agent: selectedAgentId, session: newSessionId })
  }

  // Map API agents to UI agent format
  const uiAgents = useMemo(() => agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    type: agent.id.includes('research') ? 'research' as const :
          agent.id.includes('coding') ? 'coding' as const :
          'analyst' as const,
    status: agent.status === 'active' ? 'active' as const : 'idle' as const,
    description: `${agent.name} is ready to help`,
    model: 'claude-sonnet-4-5',
    systemPrompt: '',
    tools: [],
    metrics: {
      totalSessions: 0,
      totalMessages: 0,
      avgResponseTime: 0,
      successRate: 0,
      tokensUsed: 0,
    },
    createdAt: new Date(),
    lastActiveAt: new Date(),
  })), [agents])

  const selectedAgent = uiAgents.find((a) => a.id === selectedAgentId)

  const handleSendMessage = async (content: string) => {
    if (!selectedAgentId || isProcessing || !currentSessionId) return

    const newMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    }

    // Add user message to current session
    setSessionMessages(prev => ({
      ...prev,
      [currentSessionId]: [...(prev[currentSessionId] || []), newMessage]
    }))

    setIsProcessing(true)

    try {
      // Call agent API
      const response = await invokeAgent({
        agent_id: selectedAgentId,
        input: content,
        session_id: currentSessionId,
      })

      // Add agent response
      const agentMessage: AgentMessage = {
        id: `msg-${Date.now()}-response`,
        role: "assistant",
        content: response.output,
        timestamp: new Date(),
      }

      setSessionMessages(prev => ({
        ...prev,
        [currentSessionId]: [...(prev[currentSessionId] || []), agentMessage]
      }))
    } catch (err) {
      const errorMessage: AgentMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
        timestamp: new Date(),
      }

      setSessionMessages(prev => ({
        ...prev,
        [currentSessionId]: [...(prev[currentSessionId] || []), errorMessage]
      }))
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        Loading agents...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-red-500">
        Error: {error}
      </div>
    )
  }

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        No agents available
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Agent selector sidebar */}
      <Card className="w-64 shrink-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm">Agents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-1 p-2">
              {uiAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgentId(agent.id)
                    setSearchParams({ agent: agent.id })
                  }}
                  className={cn(
                    "w-full rounded-lg p-3 text-left transition-colors",
                    agent.id === selectedAgentId
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md",
                        typeColors[agent.type]
                      )}
                    >
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-medium text-sm">
                        {agent.name}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col min-w-0">
        <CardHeader className="border-b py-3 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                typeColors[selectedAgent.type]
              )}
            >
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{selectedAgent.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {selectedAgent.model}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
            <Badge variant={statusColors[selectedAgent.status]}>
              {selectedAgent.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-5rem)] p-0">
          <ChatInterface
            agent={selectedAgent}
            messages={messages}
            sessionId={currentSessionId}
            onSendMessage={handleSendMessage}
          />
        </CardContent>
      </Card>
    </div>
  )
}

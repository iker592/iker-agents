import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Bot, ChevronDown, Brain } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatInterface } from "@/components/agents/ChatInterface"
import { ThoughtLog } from "@/components/agents/ThoughtLog"
import { mockAgents, mockMessages, mockThoughtLog } from "@/data/agents"
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
  const [searchParams] = useSearchParams()
  const agentId = searchParams.get("agent") || mockAgents[0].id
  const [selectedAgentId, setSelectedAgentId] = useState(agentId)
  const [showThoughts, setShowThoughts] = useState(true)
  const [messages, setMessages] = useState<AgentMessage[]>(mockMessages)

  const selectedAgent = mockAgents.find((a) => a.id === selectedAgentId)!

  const handleSendMessage = (content: string) => {
    const newMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    }
    setMessages([...messages, newMessage])

    // Simulate agent response
    setTimeout(() => {
      const response: AgentMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: `I received your message: "${content}". This is a simulated response from ${selectedAgent.name}.`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, response])
    }, 1500)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Agents sidebar */}
      <Card className="w-72 shrink-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Select Agent</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-14rem)]">
            <div className="space-y-1 p-2">
              {mockAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                    selectedAgentId === agent.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      selectedAgentId === agent.id
                        ? "bg-primary-foreground/20"
                        : typeColors[agent.type]
                    )}
                  >
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate font-medium">{agent.name}</p>
                    <p
                      className={cn(
                        "truncate text-xs",
                        selectedAgentId === agent.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {agent.type} agent
                    </p>
                  </div>
                  <Badge
                    variant={
                      selectedAgentId === agent.id
                        ? "outline"
                        : statusColors[agent.status]
                    }
                    className={cn(
                      selectedAgentId === agent.id &&
                        "border-primary-foreground/30 text-primary-foreground"
                    )}
                  >
                    {agent.status}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3">
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
              <CardTitle className="text-lg">{selectedAgent.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedAgent.description}
              </p>
            </div>
          </div>
          <Badge variant={statusColors[selectedAgent.status]}>
            {selectedAgent.status}
          </Badge>
        </CardHeader>
        <CardContent className="h-[calc(100%-5rem)] p-0">
          <ChatInterface
            agent={selectedAgent}
            messages={messages}
            onSendMessage={handleSendMessage}
          />
        </CardContent>
      </Card>

      {/* Thought log sidebar */}
      <Card className={cn("w-80 shrink-0 transition-all", !showThoughts && "w-12")}>
        <CardHeader
          className="cursor-pointer border-b py-3"
          onClick={() => setShowThoughts(!showThoughts)}
        >
          <div className="flex items-center justify-between">
            {showThoughts && (
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4" />
                Thought Log
              </CardTitle>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                !showThoughts && "rotate-90"
              )}
            />
          </div>
        </CardHeader>
        {showThoughts && (
          <CardContent className="h-[calc(100%-3.5rem)] p-4">
            <ThoughtLog entries={mockThoughtLog} />
          </CardContent>
        )}
      </Card>
    </div>
  )
}

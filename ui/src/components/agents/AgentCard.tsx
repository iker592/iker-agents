import { Link } from "react-router-dom"
import { Bot, Activity, Clock, MessageSquare, Zap } from "lucide-react"
import type { Agent } from "@/types/agent"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AgentCardProps {
  agent: Agent
}

const statusColors = {
  active: "success",
  idle: "secondary",
  error: "destructive",
  stopped: "outline",
} as const

const typeIcons = {
  research: "bg-blue-500/10 text-blue-500",
  coding: "bg-purple-500/10 text-purple-500",
  analyst: "bg-green-500/10 text-green-500",
  custom: "bg-orange-500/10 text-orange-500",
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card className="group transition-all hover:shadow-lg hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                typeIcons[agent.type]
              )}
            >
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">{agent.name}</h3>
              <p className="text-xs text-muted-foreground capitalize">
                {agent.type} agent
              </p>
            </div>
          </div>
          <Badge variant={statusColors[agent.status]}>{agent.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
          {agent.description}
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span>{agent.metrics.totalMessages.toLocaleString()} msgs</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span>{agent.metrics.successRate}% success</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span>{agent.metrics.avgResponseTime}s avg</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatTimeAgo(agent.lastActiveAt)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link to={`/chat?agent=${agent.id}`}>Chat</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/agents/${agent.id}`}>Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

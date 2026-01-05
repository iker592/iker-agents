import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentCard } from "@/components/agents/AgentCard"
import { AgentStats } from "@/components/agents/AgentStats"
import { mockAgents, mockSessions } from "@/data/agents"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Link } from "react-router-dom"

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

export function Dashboard() {
  const recentSessions = mockSessions.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage your AI agents
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      <AgentStats agents={mockAgents} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Agents</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/agents">View all</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {mockAgents.slice(0, 4).map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {recentSessions.map((session) => {
                    const agent = mockAgents.find(
                      (a) => a.id === session.agentId
                    )
                    return (
                      <div
                        key={session.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{agent?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.messageCount} messages
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              session.status === "active"
                                ? "success"
                                : session.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {session.status}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatTimeAgo(session.startedAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

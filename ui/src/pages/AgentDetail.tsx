import { useParams, Link } from "react-router-dom"
import {
  ArrowLeft,
  Bot,
  Play,
  Pause,
  Settings,
  MessageSquare,
  Activity,
  Zap,
  Clock,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ThoughtLog } from "@/components/agents/ThoughtLog"
import { mockAgents, mockSessions, mockThoughtLog } from "@/data/agents"
import { cn } from "@/lib/utils"

const statusColors = {
  active: "success",
  idle: "secondary",
  error: "destructive",
  stopped: "outline",
} as const

const typeColors = {
  research: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  coding: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  analyst: "bg-green-500/10 text-green-500 border-green-500/20",
  custom: "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function AgentDetail() {
  const { agentId } = useParams()
  const agent = mockAgents.find((a) => a.id === agentId)
  const agentSessions = mockSessions.filter((s) => s.agentId === agentId)

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium">Agent not found</p>
        <Button asChild className="mt-4">
          <Link to="/agents">Back to Agents</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl border",
                typeColors[agent.type]
              )}
            >
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <Badge variant={statusColors[agent.status]}>
                  {agent.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">{agent.description}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {agent.status === "active" ? (
            <Button variant="outline">
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button variant="outline">
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          <Button asChild>
            <Link to={`/chat?agent=${agent.id}`}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Link>
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Messages</p>
                <p className="text-xl font-bold">
                  {agent.metrics.totalMessages.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Activity className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-xl font-bold">{agent.metrics.successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Zap className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-xl font-bold">
                  {agent.metrics.avgResponseTime}s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sessions</p>
                <p className="text-xl font-bold">
                  {agent.metrics.totalSessions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="thought-log">Thought Log</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Tools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agent.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{tool.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                      <Badge variant={tool.enabled ? "success" : "secondary"}>
                        {tool.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm whitespace-pre-wrap">
                    {agent.systemPrompt}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Model: {agent.model}</span>
                  <span>Created: {formatDate(agent.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Token Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>Monthly Usage</span>
                    <span className="font-medium">
                      {(agent.metrics.tokensUsed / 1000).toFixed(1)}K /{" "}
                      1,000K tokens
                    </span>
                  </div>
                  <Progress
                    value={(agent.metrics.tokensUsed / 1000000) * 100}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thought-log">
          <Card>
            <CardHeader>
              <CardTitle>Agent Reasoning</CardTitle>
            </CardHeader>
            <CardContent>
              <ThoughtLog entries={mockThoughtLog} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {agentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{session.id}</p>
                        <p className="text-sm text-muted-foreground">
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
                          {formatDate(session.startedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Agent Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Settings configuration coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

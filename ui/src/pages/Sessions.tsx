import { useState } from "react"
import { Search, Filter, Clock, MessageSquare, Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { mockAgents, mockSessions } from "@/data/agents"
import { cn } from "@/lib/utils"
import type { AgentSession } from "@/types/agent"

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

function formatDuration(start: Date, end?: Date): string {
  const endTime = end || new Date()
  const seconds = Math.floor((endTime.getTime() - start.getTime()) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

export function Sessions() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    AgentSession["status"] | "all"
  >("all")

  const filteredSessions = mockSessions.filter((session) => {
    const agent = mockAgents.find((a) => a.id === session.agentId)
    const matchesSearch =
      agent?.name.toLowerCase().includes(search.toLowerCase()) ||
      session.id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === "all" || session.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const activeSessions = mockSessions.filter((s) => s.status === "active")
  const completedSessions = mockSessions.filter((s) => s.status === "completed")
  const errorSessions = mockSessions.filter((s) => s.status === "error")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <p className="text-muted-foreground">
          View and manage agent conversation sessions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <div className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold">{completedSessions.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold">{errorSessions.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <span className="text-lg">!</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as AgentSession["status"] | "all")
          }
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredSessions.map((session) => {
                const agent = mockAgents.find((a) => a.id === session.agentId)
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          agent?.type === "research" &&
                            "bg-blue-500/10 text-blue-500",
                          agent?.type === "coding" &&
                            "bg-purple-500/10 text-purple-500",
                          agent?.type === "analyst" &&
                            "bg-green-500/10 text-green-500"
                        )}
                      >
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{agent?.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {session.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {session.messageCount} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(session.startedAt, session.endedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
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
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

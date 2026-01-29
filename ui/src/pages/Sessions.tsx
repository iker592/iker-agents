import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Filter, Clock, MessageSquare, Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAgents } from "@/hooks/useAgents"
import { loadSessions, type StoredSession } from "@/services/api"
import { cn } from "@/lib/utils"

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
  const navigate = useNavigate()
  const { agents } = useAgents()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    StoredSession["status"] | "all"
  >("all")
  const [sessions, setSessions] = useState<StoredSession[]>([])

  // Load sessions from localStorage on mount
  useEffect(() => {
    setSessions(loadSessions())
  }, [])

  // Reload sessions periodically (every 2 seconds) to show updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(loadSessions())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const filteredSessions = sessions.filter((session) => {
    const agent = agents.find((a) => a.id === session.agentId)
    const matchesSearch =
      agent?.name.toLowerCase().includes(search.toLowerCase()) ||
      session.id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === "all" || session.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Group sessions by agent
  const sessionsByAgent = filteredSessions.reduce((acc, session) => {
    if (!acc[session.agentId]) {
      acc[session.agentId] = []
    }
    acc[session.agentId].push(session)
    return acc
  }, {} as Record<string, StoredSession[]>)

  const activeSessions = sessions.filter((s) => s.status === "active")
  const completedSessions = sessions.filter((s) => s.status === "completed")
  const errorSessions = sessions.filter((s) => s.status === "error")

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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as StoredSession["status"] | "all")
            }
            className="flex-1 sm:flex-none"
          >
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Done</TabsTrigger>
              <TabsTrigger value="error">Error</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" className="hidden sm:flex">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions by Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {filteredSessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No sessions yet. Start chatting with an agent to create a session.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(sessionsByAgent).map(([agentId, agentSessions]) => {
                  const agent = agents.find((a) => a.id === agentId)
                  const agentType = agent?.id.includes('research') ? 'research' :
                                   agent?.id.includes('coding') ? 'coding' : 'analyst'

                  return (
                    <div key={agentId} className="space-y-3">
                      {/* Agent header */}
                      <div className="flex items-center gap-3 px-2">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            agentType === "research" && "bg-blue-500/10 text-blue-500",
                            agentType === "coding" && "bg-purple-500/10 text-purple-500",
                            agentType === "analyst" && "bg-green-500/10 text-green-500"
                          )}
                        >
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{agent?.name || agentId}</p>
                          <p className="text-xs text-muted-foreground">
                            {agentSessions.length} session{agentSessions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Sessions for this agent */}
                      <div className="space-y-2">
                        {agentSessions.map((session) => {
                          const startedAt = new Date(session.startedAt)
                          const lastActivity = new Date(session.lastActivity)

                          return (
                            <div
                              key={session.id}
                              onClick={() => navigate(`/chat?agent=${session.agentId}&session=${session.id}`)}
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50 cursor-pointer gap-2"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                                      {session.id.substring(0, 12)}...
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
                                      {session.messageCount}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDuration(startedAt, lastActivity)}
                                    </span>
                                    <span className="text-xs">
                                      {formatTimeAgo(startedAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Badge
                                variant={
                                  session.status === "active"
                                    ? "success"
                                    : session.status === "error"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="self-end sm:self-auto"
                              >
                                {session.status}
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

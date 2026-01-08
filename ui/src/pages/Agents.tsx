import { useState } from "react"
import { Plus, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AgentCard } from "@/components/agents/AgentCard"
import { useAgents } from "@/hooks/useAgents"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AgentStatus } from "@/types/agent"

export function Agents() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all")
  const { agents, loading, error } = useAgents()

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.description.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === "all" || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground">
            View and manage all your AI agents
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI agent with custom tools and settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent Name</label>
                <Input placeholder="My Agent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input placeholder="What does this agent do?" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent Type</label>
                <Tabs defaultValue="research" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="research">Research</TabsTrigger>
                    <TabsTrigger value="coding">Coding</TabsTrigger>
                    <TabsTrigger value="analyst">Analyst</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Create Agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AgentStatus | "all")}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="idle">Idle</TabsTrigger>
            <TabsTrigger value="error">Error</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium text-destructive">Error loading agents</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium">No agents found</p>
          <p className="text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}

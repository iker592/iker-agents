import { Bot, MessageSquare, Activity, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Agent } from "@/types/agent"

interface AgentStatsProps {
  agents: Agent[]
}

export function AgentStats({ agents }: AgentStatsProps) {
  const activeAgents = agents.filter((a) => a.status === "active").length
  const totalMessages = agents.reduce(
    (sum, a) => sum + a.metrics.totalMessages,
    0
  )
  const avgSuccessRate =
    agents.reduce((sum, a) => sum + a.metrics.successRate, 0) / agents.length
  const avgResponseTime =
    agents.reduce((sum, a) => sum + a.metrics.avgResponseTime, 0) /
    agents.length

  const stats = [
    {
      name: "Active Agents",
      value: activeAgents,
      total: agents.length,
      icon: Bot,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      name: "Total Messages",
      value: totalMessages.toLocaleString(),
      icon: MessageSquare,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      name: "Avg Success Rate",
      value: `${avgSuccessRate.toFixed(1)}%`,
      icon: Activity,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      name: "Avg Response Time",
      value: `${avgResponseTime.toFixed(1)}s`,
      icon: Zap,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.name}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bgColor}`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-bold">
                  {stat.value}
                  {stat.total !== undefined && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {stat.total}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

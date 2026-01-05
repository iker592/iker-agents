import { Brain, Wrench, CheckCircle, Lightbulb } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ThoughtLogEntry } from "@/types/agent"
import { cn } from "@/lib/utils"

interface ThoughtLogProps {
  entries: ThoughtLogEntry[]
}

const typeConfig = {
  thinking: {
    icon: Brain,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Thinking",
  },
  tool_call: {
    icon: Wrench,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Tool Call",
  },
  tool_result: {
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Result",
  },
  decision: {
    icon: Lightbulb,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Decision",
  },
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ThoughtLog({ entries }: ThoughtLogProps) {
  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {entries.map((entry, index) => {
          const config = typeConfig[entry.type]
          const Icon = config.icon

          return (
            <div key={entry.id} className="relative">
              {index < entries.length - 1 && (
                <div className="absolute left-5 top-10 h-full w-px bg-border" />
              )}
              <div className="flex gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    config.bgColor
                  )}
                >
                  <Icon className={cn("h-5 w-5", config.color)} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entry.content}
                  </p>
                  {entry.metadata && (
                    <div className="mt-2 rounded-md bg-muted p-2 font-mono text-xs">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

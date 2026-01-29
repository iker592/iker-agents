import { Wrench, Check, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types/agent"

interface ToolCallBoxProps {
  toolCall: ToolCall
}

export function ToolCallBox({ toolCall }: ToolCallBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusIcon = {
    pending: <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />,
    running: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    completed: <Check className="h-3 w-3 text-green-500" />,
    error: <span className="h-3 w-3 text-red-500">!</span>,
  }

  const statusColors = {
    pending: "border-yellow-500/30 bg-yellow-500/5",
    running: "border-blue-500/30 bg-blue-500/5",
    completed: "border-green-500/30 bg-green-500/5",
    error: "border-red-500/30 bg-red-500/5",
  }

  // Try to parse and format JSON arguments
  const formatArgs = (args: string) => {
    if (!args) return null
    try {
      const parsed = JSON.parse(args)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return args
    }
  }

  // Try to parse and format JSON result
  const formatResult = (result: string) => {
    if (!result) return null
    try {
      const parsed = JSON.parse(result)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return result
    }
  }

  const formattedArgs = formatArgs(toolCall.arguments)
  const formattedResult = toolCall.result ? formatResult(toolCall.result) : null
  const hasDetails = formattedArgs || formattedResult

  return (
    <div
      className={cn(
        "rounded-lg border p-3 my-2 text-xs",
        statusColors[toolCall.status]
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2",
          hasDetails && "cursor-pointer"
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {hasDetails && (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        )}
        <Wrench className="h-3 w-3 text-purple-500" />
        <span className="font-medium text-purple-400">{toolCall.name}</span>
        <span className="flex-1" />
        {statusIcon[toolCall.status]}
        <span className="text-muted-foreground capitalize">
          {toolCall.status}
        </span>
      </div>

      {/* Expandable details */}
      {isExpanded && hasDetails && (
        <div className="mt-3 space-y-2">
          {/* Arguments */}
          {formattedArgs && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Arguments
              </div>
              <pre className="rounded bg-background/50 p-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap">
                {formattedArgs}
              </pre>
            </div>
          )}

          {/* Result */}
          {formattedResult && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Result
              </div>
              <pre className="rounded bg-background/50 p-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {formattedResult.length > 500
                  ? formattedResult.substring(0, 500) + "..."
                  : formattedResult}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

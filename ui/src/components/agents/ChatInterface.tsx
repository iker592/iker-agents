import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Wrench, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Agent, AgentMessage } from "@/types/agent"

interface ChatInterfaceProps {
  agent: Agent
  messages: AgentMessage[]
  sessionId?: string
  onSendMessage?: (content: string) => void
  onClearChat?: () => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ChatInterface({
  agent,
  messages,
  sessionId,
  onSendMessage,
  onClearChat,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const message = input.trim()
    setInput("")
    setIsLoading(true)

    if (onSendMessage) {
      onSendMessage(message)
    }

    // Simulate response delay
    setTimeout(() => {
      setIsLoading(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <Avatar
                className={cn(
                  "h-8 w-8",
                  message.role === "tool" && "bg-purple-500/10"
                )}
              >
                <AvatarFallback
                  className={cn(
                    message.role === "assistant" && "bg-primary text-primary-foreground",
                    message.role === "user" && "bg-secondary",
                    message.role === "tool" && "bg-purple-500/10 text-purple-500"
                  )}
                >
                  {message.role === "user" && <User className="h-4 w-4" />}
                  {message.role === "assistant" && <Bot className="h-4 w-4" />}
                  {message.role === "tool" && <Wrench className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "max-w-[80%] space-y-1",
                  message.role === "user" && "items-end"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-4 py-2",
                    message.role === "user" &&
                      "bg-primary text-primary-foreground",
                    message.role === "assistant" && "bg-muted",
                    message.role === "tool" &&
                      "border border-purple-500/20 bg-purple-500/5"
                  )}
                >
                  {message.role === "tool" && (
                    <div className="mb-1 text-xs font-medium text-purple-500">
                      {message.toolName}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.toolResult && (
                    <div className="mt-2 rounded bg-background/50 p-2 font-mono text-xs">
                      {message.toolResult}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground px-1">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {agent.name} is thinking...
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}...`}
            className="min-h-[44px] max-h-32 resize-none"
            disabled={isLoading}
          />
          {onClearChat && messages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClearChat}
              title="Clear chat and start new session"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="text-center flex-1">
            Press Enter to send, Shift+Enter for new line
          </span>
          {sessionId && (
            <span className="font-mono text-[10px] opacity-50" title={`Session: ${sessionId}`}>
              {sessionId.substring(0, 12)}...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

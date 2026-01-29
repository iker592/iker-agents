import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Wrench, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ToolCallBox } from "./ToolCallBox"
import type { Agent, AgentMessage, ToolCall } from "@/types/agent"

// Markdown components for consistent styling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markdownComponents: any = {
  // Style code blocks
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="rounded-md bg-background/50 p-3 overflow-x-auto">
      {children}
    </pre>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className
    return isInline ? (
      <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
        {children}
      </code>
    ) : (
      <code className={cn("text-xs", className)}>
        {children}
      </code>
    )
  },
  // Style lists
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-4 space-y-1">{children}</ol>
  ),
  // Style headings
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
  ),
  // Style paragraphs
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  // Style strong/bold
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
}

// Helper to render markdown text
function MarkdownText({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}

// Render message content with inline tool calls
function MessageContent({ message }: { message: AgentMessage }) {
  const toolCallsMap = new Map<string, ToolCall>()
  if (message.toolCalls) {
    message.toolCalls.forEach(tc => toolCallsMap.set(tc.id, tc))
  }

  // If we have segments, render them in order (inline tool calls)
  if (message.segments && message.segments.length > 0) {
    return (
      <div className="prose prose-sm prose-invert max-w-none text-sm">
        {message.segments.map((segment, index) => {
          if (segment.type === 'text' && segment.text) {
            return <MarkdownText key={`text-${index}`} content={segment.text} />
          } else if (segment.type === 'tool' && segment.toolCallId) {
            const toolCall = toolCallsMap.get(segment.toolCallId)
            if (toolCall) {
              return <ToolCallBox key={`tool-${segment.toolCallId}`} toolCall={toolCall} />
            }
          }
          return null
        })}
        {/* Streaming indicator */}
        {message.isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
        )}
      </div>
    )
  }

  // Legacy: toolCalls at top, then content (for backwards compatibility)
  return (
    <>
      {/* Tool calls boxes (legacy - all at top) */}
      {message.toolCalls && message.toolCalls.length > 0 && !message.segments && (
        <div className="mb-3">
          {message.toolCalls.map((toolCall) => (
            <ToolCallBox key={toolCall.id} toolCall={toolCall} />
          ))}
        </div>
      )}
      <div className="prose prose-sm prose-invert max-w-none text-sm">
        <MarkdownText content={message.content} />
        {/* Streaming indicator */}
        {message.isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
        )}
      </div>
    </>
  )
}

interface ChatInterfaceProps {
  agent: Agent
  messages: AgentMessage[]
  sessionId?: string
  onSendMessage?: (content: string) => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ChatInterface({
  agent,
  messages,
  sessionId,
  onSendMessage,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get the last message to detect streaming updates
  const lastMessage = messages[messages.length - 1]
  const isStreaming = lastMessage?.isStreaming
  const streamingContent = isStreaming ? lastMessage.content : null
  const streamingSegmentsCount = isStreaming ? (lastMessage.segments?.length || 0) : 0

  // Scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, streamingContent, streamingSegmentsCount])

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
      <ScrollArea className="flex-1 p-4">
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
                  {/* Legacy tool call indicator (for very old messages) */}
                  {!message.toolCalls && !message.segments && message.toolName && (
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-purple-500">
                      <Wrench className="h-3 w-3 animate-pulse" />
                      <span>Using {message.toolName}...</span>
                    </div>
                  )}
                  {message.role === "tool" && (
                    <div className="mb-1 text-xs font-medium text-purple-500">
                      {message.toolName}
                    </div>
                  )}
                  {/* Render markdown for assistant messages with inline tool calls */}
                  {message.role === "assistant" ? (
                    <MessageContent message={message} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
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
          {/* Scroll anchor - always scroll to this element */}
          <div ref={messagesEndRef} />
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

"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaperAirplaneIcon as Send, SparklesIcon as Sparkles, MicrophoneIcon as Mic, DocumentDuplicateIcon as Copy, HandThumbUpIcon as ThumbsUp, HandThumbDownIcon as ThumbsDown, XMarkIcon as X } from "@heroicons/react/24/outline"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  suggestions?: string[]
}

export function AIAssistantPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I'm RO Engine's AI Assistant. I can help you with repair estimates, customer communications, service recommendations, and much more. What would you like help with?",
      timestamp: new Date(),
      suggestions: ["Estimate this service", "Draft customer message", "Find similar ROs", "Schedule maintenance"],
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = (message?: string) => {
    const textToSend = message || input
    if (!textToSend.trim()) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: generateAIResponse(textToSend),
        timestamp: new Date(),
        suggestions:
          textToSend.toLowerCase().includes("estimate") || textToSend.toLowerCase().includes("service")
            ? ["Generate formal estimate", "Send to customer", "Adjust price", "Add to RO"]
            : ["Copy to clipboard", "Send message", "Schedule follow-up"],
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  const generateAIResponse = (userInput: string): string => {
    const lower = userInput.toLowerCase()

    if (lower.includes("estimate")) {
      return "Based on the 2022 Tesla Model 3 and Battery Diagnostic service, I recommend an estimate of $1,250. This includes 2 hours diagnostic labor at $225/hr and Tesla-specific parts. The customer has a 95% approval rate with premium services. Would you like me to generate a formal estimate?"
    }

    if (lower.includes("message")) {
      return `Here's a suggested message for John Mitchell: "Hi John, Your Tesla Model 3 has completed the initial diagnostic. We found the battery management system needs calibration, which we can handle today. Estimated cost: $1,250. Please confirm and we'll proceed. Thanks!"`
    }

    if (lower.includes("maintenance") || lower.includes("schedule")) {
      return "For this Honda Civic with 95,400 miles, I recommend scheduling: Transmission flush (overdue), Brake inspection, and coolant flush. These services typically cost $380-500 total and would take 2-3 hours. The customer hasn't been in since November, so this is a good opportunity for retention."
    }

    if (lower.includes("similar")) {
      return "I found 3 similar repair orders in the last month: RO-4412 (same Tesla diagnostic), RO-4398 (similar BMW service), and RO-4375 (same technician). Average resolution time: 1.8 hours. Success rate with this customer type: 87%."
    }

    return "I'm analyzing your request. Based on your current workload and customer history, here are my recommendations: 1) Prioritize high-value customers for premium services, 2) Consider bundling services for efficiency, 3) Send proactive maintenance reminders to inactive customers. How can I help further?"
  }

  if (!isOpen) return null

  return (
    <div className="fixed right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] z-40 animate-in fade-in slide-in-from-bottom-4">
      <Card className="border-border shadow-lg overflow-hidden flex flex-col h-[600px]">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent to-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent-foreground/20">
              <Sparkles size={18} className="text-accent-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-accent-foreground">RO AI Assistant</h3>
              <p className="text-xs text-accent-foreground/80">Always learning from your shop</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-accent-foreground hover:bg-accent-foreground/20"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs px-4 py-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-accent text-accent-foreground rounded-br-none"
                    : "bg-muted border border-border text-foreground rounded-bl-none"
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>

                {/* Suggestions */}
                {message.role === "assistant" && message.suggestions && (
                  <div className="mt-3 space-y-2">
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(suggestion)}
                        className="block w-full text-left text-xs px-2 py-1.5 rounded bg-background/50 border border-border text-muted-foreground hover:bg-background hover:text-foreground transition-colors text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {message.role === "assistant" && (
                  <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Copy"
                    >
                      <Copy size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600"
                      title="Helpful"
                    >
                      <ThumbsUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="Not helpful"
                    >
                      <ThumbsDown size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border px-4 py-3 rounded-lg rounded-bl-none">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <div
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 space-y-2 bg-card">
          <div className="flex gap-2">
            <Input
              placeholder="Ask RO AI anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="bg-background border-border placeholder:text-muted-foreground"
            />
            <Button size="icon" onClick={() => handleSendMessage()} className="flex-shrink-0">
              <Send size={18} />
            </Button>
            <Button size="icon" variant="outline" className="flex-shrink-0 bg-transparent">
              <Mic size={18} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">AI helps with estimates, messaging, scheduling & insights</p>
        </div>
      </Card>
    </div>
  )
}

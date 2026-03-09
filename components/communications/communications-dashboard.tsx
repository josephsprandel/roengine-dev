"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  MessageSquare,
  Mail,
  Phone,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  Wifi,
} from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils/phone-format"

interface Message {
  id: number
  work_order_id: number | null
  customer_id: number | null
  channel: string
  to_phone: string
  from_phone: string | null
  email_address: string | null
  subject: string | null
  message_body: string
  message_type: string
  twilio_sid: string | null
  status: string
  direction: string
  error_code: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  created_at: string
  customer_name: string | null
  ro_number: string | null
  recording_url: string | null
  duration_seconds: number | null
  retell_call_id: string | null
  template_data: Record<string, any> | null
}

const MESSAGE_TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "estimate_link", label: "Estimate (SMS)" },
  { value: "estimate_ready", label: "Estimate (Email)" },
  { value: "status_update", label: "Status Update" },
  { value: "pickup_ready", label: "Pickup Ready (SMS)" },
  { value: "ready_for_pickup", label: "Pickup Ready (Email)" },
  { value: "invoice_email", label: "Invoice" },
  { value: "appointment_reminder", label: "Reminder" },
  { value: "approval_request", label: "Approval" },
  { value: "custom", label: "Custom" },
  { value: "inbound_reply", label: "Inbound Reply" },
  { value: "inbound_call", label: "Inbound Call" },
]

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  queued: { icon: Clock, color: "text-muted-foreground", label: "Queued" },
  sent: { icon: Send, color: "text-blue-500", label: "Sent" },
  delivered: { icon: CheckCircle, color: "text-green-500", label: "Delivered" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
  undelivered: { icon: AlertTriangle, color: "text-amber-500", label: "Undelivered" },
  received: { icon: MessageSquare, color: "text-primary", label: "Received" },
}

const TYPE_LABELS: Record<string, string> = {
  estimate_link: "Estimate",
  estimate_ready: "Estimate",
  status_update: "Status Update",
  pickup_ready: "Pickup Ready",
  ready_for_pickup: "Pickup Ready",
  invoice_email: "Invoice",
  appointment_reminder: "Reminder",
  approval_request: "Approval",
  custom: "Custom",
  inbound_reply: "Reply",
  inbound_call: "Inbound Call",
}

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function SentimentBadge({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return <span className="text-muted-foreground">—</span>
  const colors: Record<string, string> = {
    positive: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    negative: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  }
  return (
    <Badge className={colors[sentiment] || colors.neutral}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </Badge>
  )
}

const PAGE_SIZE = 25

export function CommunicationsDashboard() {
  const [messages, setMessages] = useState<Message[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [channelFilter, setChannelFilter] = useState<"all" | "sms" | "email" | "call">("all")
  const [selectedCall, setSelectedCall] = useState<Message | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const isDev = process.env.NODE_ENV === "development"

  // SMS health check state
  const [smsProvider, setSmsProvider] = useState<string | null>(null)
  const [shopPhone, setShopPhone] = useState("")
  const [testPhone, setTestPhone] = useState("")
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; dryRun?: boolean; timestamp: string } | null>(() => {
    if (typeof window === "undefined") return null
    const saved = localStorage.getItem("sms_test_result")
    return saved ? JSON.parse(saved) : null
  })
  const [showTestForm, setShowTestForm] = useState(false)

  // Load SMS provider info
  useEffect(() => {
    fetch("/api/sms/test")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setSmsProvider(data.provider === "twilio" ? "Twilio" : "MessageBird")
          setShopPhone(data.shopPhone || "")
          if (!testPhone) setTestPhone(data.shopPhone || "")
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSendTest() {
    if (!testPhone.trim()) return
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      })
      const data = await res.json()
      const result = {
        success: data.success,
        error: data.error,
        dryRun: data.dryRun,
        timestamp: new Date().toISOString(),
      }
      setTestResult(result)
      localStorage.setItem("sms_test_result", JSON.stringify(result))
    } catch (err) {
      const result = {
        success: false,
        error: "Network error",
        timestamp: new Date().toISOString(),
      }
      setTestResult(result)
      localStorage.setItem("sms_test_result", JSON.stringify(result))
    } finally {
      setTestSending(false)
    }
  }

  const handleDelete = async (msg: Message, e: React.MouseEvent) => {
    e.stopPropagation() // Don't open call modal when clicking delete

    // Production: confirm first. Dev: delete immediately.
    if (!isDev) {
      const label = msg.channel === "call"
        ? (msg.subject || "this call record")
        : msg.channel === "email"
          ? (msg.subject || "this email")
          : "this message"
      if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return
    }

    setDeletingId(msg.id)
    try {
      const res = await fetch(`/api/messages/${msg.id}`, { method: "DELETE" })
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id))
        setTotal((prev) => prev - 1)
      } else {
        const data = await res.json()
        console.error("Failed to delete message:", data.error)
      }
    } catch (err) {
      console.error("Failed to delete message:", err)
    }
    setDeletingId(null)
  }

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      if (search) params.set("search", search)
      if (typeFilter !== "all") params.set("messageType", typeFilter)
      if (channelFilter !== "all") params.set("channel", channelFilter)

      const res = await fetch(`/api/messages?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error("Failed to fetch message history:", error)
    }
    setLoading(false)
  }, [page, search, typeFilter, channelFilter])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const handleSearch = () => {
    setPage(0)
    setSearch(searchInput)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Parse call metadata from template_data for the selected call
  const callData = selectedCall?.template_data
    ? (typeof selectedCall.template_data === "string"
        ? JSON.parse(selectedCall.template_data as unknown as string)
        : selectedCall.template_data)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communications</h1>
          <p className="text-sm text-muted-foreground">SMS, Email & Call history</p>
        </div>
        {smsProvider && (
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Wifi size={12} className="text-green-500" />
            SMS: {smsProvider}
          </Badge>
        )}
      </div>

      {/* SMS Health Check */}
      <Card className="p-4 border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">SMS Status</span>
            </div>
            {smsProvider && (
              <Badge variant="secondary" className="text-xs">{smsProvider}</Badge>
            )}
            {testResult && (
              <span className="text-xs text-muted-foreground">
                Last tested: {new Date(testResult.timestamp).toLocaleString([], {
                  month: "long", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit",
                })}
                {" — "}
                {testResult.success ? (
                  <span className="text-green-600 dark:text-green-400">
                    {testResult.dryRun ? "OK (dry run)" : "OK"}
                  </span>
                ) : (
                  <span className="text-destructive">Failed</span>
                )}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent gap-1.5"
            onClick={() => setShowTestForm(!showTestForm)}
          >
            <Send size={14} />
            Send Test SMS
          </Button>
        </div>

        {showTestForm && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-xs space-y-1">
                <label className="text-xs text-muted-foreground">Phone number</label>
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="(479) 301-2880"
                  className="bg-card border-border"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSendTest}
                disabled={testSending || !testPhone.trim()}
              >
                {testSending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Send size={14} className="mr-1.5" />}
                {testSending ? "Sending..." : "Send"}
              </Button>
            </div>
            {testResult && (
              <div className={`mt-2 flex items-center gap-1.5 text-sm ${testResult.success ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {testResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testResult.success
                  ? testResult.dryRun ? "Delivered (dry run — SMS_DRY_RUN=true)" : "Delivered"
                  : `Failed: ${testResult.error}`}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="p-4 border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by customer, phone, or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleSearch} className="bg-transparent">
            Search
          </Button>

          {/* Channel Filter Chips */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
            <Button
              variant={channelFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => { setChannelFilter("all"); setPage(0) }}
            >
              All
            </Button>
            <Button
              variant={channelFilter === "sms" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={() => { setChannelFilter("sms"); setPage(0) }}
            >
              <MessageSquare size={12} />
              SMS
            </Button>
            <Button
              variant={channelFilter === "email" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={() => { setChannelFilter("email"); setPage(0) }}
            >
              <Mail size={12} />
              Email
            </Button>
            <Button
              variant={channelFilter === "call" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={() => { setChannelFilter("call"); setPage(0) }}
            >
              <Phone size={12} />
              Calls
            </Button>
          </div>

          <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(0) }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESSAGE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            {total} message{total !== 1 ? "s" : ""}
          </div>
        </div>
      </Card>

      {/* Messages Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground w-10"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Direction</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Contact</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Message</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">RO</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                    No messages found
                  </td>
                </tr>
              ) : (
                messages.map((msg) => {
                  const statusInfo = STATUS_CONFIG[msg.status] || STATUS_CONFIG.queued
                  const StatusIcon = statusInfo.icon
                  const isEmail = msg.channel === "email"
                  const isCall = msg.channel === "call"
                  const ChannelIcon = isCall ? Phone : isEmail ? Mail : MessageSquare
                  const channelLabel = isCall ? "Call" : isEmail ? "Email" : "SMS"
                  return (
                    <tr
                      key={msg.id}
                      className={`border-b border-border hover:bg-muted/20 transition-colors ${isCall ? "cursor-pointer" : ""}`}
                      onClick={() => isCall && setSelectedCall(msg)}
                    >
                      <td className="p-3 whitespace-nowrap text-xs">
                        {new Date(msg.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        <ChannelIcon size={14} className="text-muted-foreground" title={channelLabel} />
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            msg.direction === "inbound"
                              ? "border-primary/30 text-primary"
                              : "border-border"
                          }`}
                        >
                          {msg.direction === "inbound" ? "IN" : "OUT"}
                        </Badge>
                      </td>
                      <td className="p-3 font-medium">
                        {msg.customer_name || "Unknown"}
                      </td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {isEmail
                          ? (msg.email_address || "—")
                          : isCall
                            ? formatPhoneNumber(msg.from_phone || "")
                            : formatPhoneNumber(msg.direction === "inbound" ? (msg.from_phone || "") : msg.to_phone)
                        }
                      </td>
                      <td className="p-3 max-w-xs">
                        {isCall && msg.subject && (
                          <p className="text-xs font-medium truncate">{msg.subject}</p>
                        )}
                        {isCall && msg.duration_seconds != null && (
                          <span className="text-[10px] text-muted-foreground mr-2">
                            {formatCallDuration(msg.duration_seconds)}
                          </span>
                        )}
                        {isEmail && msg.subject && (
                          <p className="text-xs font-medium truncate">{msg.subject}</p>
                        )}
                        <p className="line-clamp-2 text-xs text-foreground/70">{msg.message_body}</p>
                        {msg.error_message && (
                          <p className="text-[10px] text-destructive mt-0.5">{msg.error_message}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {TYPE_LABELS[msg.message_type] || msg.message_type}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon size={12} className={statusInfo.color} />
                          <span className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {msg.ro_number ? (
                          <a
                            href={`/repair-orders?ro=${msg.work_order_id}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {msg.ro_number}
                            <ArrowUpRight size={10} />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={(e) => handleDelete(msg, e)}
                          disabled={deletingId === msg.id}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          title="Delete message"
                        >
                          <Trash2 size={14} className={deletingId === msg.id ? "animate-pulse" : ""} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="bg-transparent"
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="bg-transparent"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Call Detail Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{selectedCall?.subject || "Call Details"}</DialogTitle>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Call metadata grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Customer</span>
                  <p className="font-medium">{selectedCall.customer_name || "Unknown"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Phone</span>
                  <p>{formatPhoneNumber(selectedCall.from_phone || "")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Duration</span>
                  <p>{selectedCall.duration_seconds != null ? formatCallDuration(selectedCall.duration_seconds) : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Sentiment</span>
                  <div className="mt-0.5">
                    <SentimentBadge sentiment={callData?.user_sentiment} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Date</span>
                  <p>{new Date(selectedCall.created_at).toLocaleString([], {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "numeric", minute: "2-digit",
                  })}</p>
                </div>
                {selectedCall.ro_number && (
                  <div>
                    <span className="text-muted-foreground text-xs">Repair Order</span>
                    <p>
                      <a
                        href={`/repair-orders?ro=${selectedCall.work_order_id}`}
                        className="text-primary hover:underline"
                      >
                        {selectedCall.ro_number}
                      </a>
                    </p>
                  </div>
                )}
              </div>

              {/* Vehicle info from call analysis */}
              {callData && (callData.vehicle_year || callData.vehicle_make) && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-medium mb-1">Vehicle</h4>
                  <p className="text-sm text-muted-foreground">
                    {[callData.vehicle_year, callData.vehicle_make, callData.vehicle_model]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                </div>
              )}

              {/* Issue description */}
              {callData?.issue_description && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-medium mb-1">Issue Description</h4>
                  <p className="text-sm text-foreground/80">{callData.issue_description}</p>
                </div>
              )}

              {/* Call summary */}
              {callData?.call_summary && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-medium mb-1">Summary</h4>
                  <p className="text-sm text-foreground/80">{callData.call_summary}</p>
                </div>
              )}

              {/* Recording audio player */}
              {selectedCall.recording_url && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-medium mb-2">Recording</h4>
                  <audio controls className="w-full" src={selectedCall.recording_url} />
                </div>
              )}

              {/* Transcript */}
              {callData?.transcript && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-sm font-medium mb-1">Transcript</h4>
                  <div className="bg-muted/30 rounded-md p-3 max-h-60 overflow-y-auto">
                    <p className="text-xs text-foreground/70 whitespace-pre-wrap">
                      {callData.transcript}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

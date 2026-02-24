"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Mail,
  Send,
  FileText,
  Truck,
  Receipt,
  Bell,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
} from "lucide-react"

interface EmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number
  customerName: string
  email: string
  workOrderId: number
  roNumber: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  grandTotal?: number
}

interface EmailMessage {
  id: number
  message_body: string
  message_type: string
  status: string
  direction: string
  created_at: string
  subject?: string
  channel?: string
  error_message?: string
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  estimate_ready: "Estimate",
  status_update: "Status Update",
  ready_for_pickup: "Pickup Ready",
  invoice_email: "Invoice",
  custom: "Custom",
  inbound_reply: "Reply",
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string }> = {
  queued: { icon: Clock, color: "text-muted-foreground" },
  sent: { icon: Send, color: "text-blue-500" },
  delivered: { icon: CheckCircle, color: "text-green-500" },
  failed: { icon: XCircle, color: "text-destructive" },
  received: { icon: Mail, color: "text-primary" },
}

export function EmailDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  email,
  workOrderId,
  roNumber,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  grandTotal,
}: EmailDialogProps) {
  const [customSubject, setCustomSubject] = useState("")
  const [customBody, setCustomBody] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [templatePreview, setTemplatePreview] = useState<{ subject: string; text: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)
  const [history, setHistory] = useState<EmailMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [emailConsent, setEmailConsent] = useState(false)
  const [consentLoading, setConsentLoading] = useState(false)
  const [shopName, setShopName] = useState('Our Shop')

  const vehicleYMM = `${vehicleYear} ${vehicleMake} ${vehicleModel}`

  // Fetch shop profile on mount
  useEffect(() => {
    fetch('/api/settings/shop-profile')
      .then(r => r.json())
      .then(data => { if (data?.profile?.shop_name) setShopName(data.profile.shop_name) })
      .catch(() => { /* uses default values on failure */ })
  }, [])

  useEffect(() => {
    if (!open) return

    const fetchData = async () => {
      // Fetch consent status
      try {
        const res = await fetch(`/api/customers/${customerId}`)
        if (res.ok) {
          const data = await res.json()
          setEmailConsent(data.customer.email_consent || false)
        }
      } catch { /* ignore */ }

      // Fetch email history
      setLoadingHistory(true)
      try {
        const res = await fetch(`/api/messages?workOrderId=${workOrderId}&channel=email&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setHistory(data.messages || [])
        }
      } catch { /* ignore */ }
      setLoadingHistory(false)
    }

    fetchData()
    setSendResult(null)
    setSelectedTemplate(null)
    setTemplatePreview(null)
    setCustomSubject("")
    setCustomBody("")
  }, [open, customerId, workOrderId])

  const handleConsentToggle = useCallback(async (checked: boolean) => {
    setConsentLoading(true)
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_consent: checked }),
      })
      if (res.ok) {
        setEmailConsent(checked)
      }
    } catch { /* ignore */ }
    setConsentLoading(false)
  }, [customerId])

  const selectTemplate = useCallback(
    (templateId: string) => {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      let subject = ""
      let text = ""

      switch (templateId) {
        case "estimate_ready":
          subject = `Your vehicle estimate is ready — ${shopName}`
          text = `Hi ${customerName.split(" ")[0]}, your estimate for your ${vehicleYMM} is ready for review. A link to the estimate will be included in the email.`
          break
        case "ready_for_pickup":
          subject = `Your ${vehicleYMM} is ready for pickup!`
          text = `Hi ${customerName.split(" ")[0]}, great news! Your ${vehicleYMM} is ready for pickup. Total: $${(grandTotal || 0).toFixed(2)}.`
          break
        case "invoice_email":
          subject = `Invoice for your ${vehicleYMM} service — ${shopName}`
          text = `Hi ${customerName.split(" ")[0]}, thank you for choosing ${shopName} for your ${vehicleYMM} service. Invoice total: $${(grandTotal || 0).toFixed(2)}.`
          break
        case "status_update":
          subject = `Update on your ${vehicleYMM} — ${shopName}`
          text = `Hi ${customerName.split(" ")[0]}, here's an update on your ${vehicleYMM}: Your vehicle is currently being serviced.`
          break
      }

      setSelectedTemplate(templateId)
      setTemplatePreview({ subject, text })
      setCustomSubject("")
      setCustomBody("")
    },
    [customerName, vehicleYMM, workOrderId, grandTotal, shopName]
  )

  const clearTemplate = useCallback(() => {
    setSelectedTemplate(null)
    setTemplatePreview(null)
  }, [])

  const handleSend = useCallback(async () => {
    setSending(true)
    setSendResult(null)

    try {
      const payload: Record<string, unknown> = {
        to: email,
        workOrderId,
        customerId,
        messageType: selectedTemplate || "custom",
      }

      if (selectedTemplate) {
        payload.templateId = selectedTemplate
        payload.templateData = {
          customerName: customerName.split(" ")[0],
          vehicleYMM,
          // estimateUrl intentionally omitted — the API will look up the tokenized URL
          total: (grandTotal || 0).toFixed(2),
          invoiceTotal: (grandTotal || 0).toFixed(2),
        }
      } else {
        payload.subject = customSubject
        payload.body = customBody
      }

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setSendResult({ success: false, message: data.error || "Failed to send" })
      } else {
        setSendResult({
          success: true,
          message: data.dryRun ? "Email logged (dry run mode)" : "Email sent successfully",
        })
        setSelectedTemplate(null)
        setTemplatePreview(null)
        setCustomSubject("")
        setCustomBody("")

        // Refresh history
        const histRes = await fetch(`/api/messages?workOrderId=${workOrderId}&channel=email&limit=10`)
        if (histRes.ok) {
          const histData = await histRes.json()
          setHistory(histData.messages || [])
        }
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Failed to send"
      setSendResult({ success: false, message: errMsg })
    }

    setSending(false)
  }, [selectedTemplate, customSubject, customBody, email, workOrderId, customerId, customerName, vehicleYMM, grandTotal])

  const canSend = emailConsent
  const hasContent = selectedTemplate || (customSubject.trim() && customBody.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={18} />
            Send Email to {customerName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {email} &middot; {roNumber}
          </p>
        </DialogHeader>

        {/* Email Consent Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div>
            <Label className="text-sm font-medium">Email Opt-in</Label>
            <p className="text-xs text-muted-foreground">
              {emailConsent
                ? "Customer consented to email"
                : "Customer must opt in before sending"}
            </p>
          </div>
          <Switch
            checked={emailConsent}
            onCheckedChange={handleConsentToggle}
            disabled={consentLoading}
          />
        </div>

        {/* Quick Templates */}
        {canSend && (
          <>
            <div>
              <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
                Quick Emails
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 justify-start bg-transparent h-auto py-2 ${selectedTemplate === "estimate_ready" ? "border-primary" : ""}`}
                  onClick={() => selectTemplate("estimate_ready")}
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="text-left">Estimate Ready</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 justify-start bg-transparent h-auto py-2 ${selectedTemplate === "ready_for_pickup" ? "border-primary" : ""}`}
                  onClick={() => selectTemplate("ready_for_pickup")}
                >
                  <Truck size={14} className="shrink-0" />
                  <span className="text-left">Ready for Pickup</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 justify-start bg-transparent h-auto py-2 ${selectedTemplate === "invoice_email" ? "border-primary" : ""}`}
                  onClick={() => selectTemplate("invoice_email")}
                >
                  <Receipt size={14} className="shrink-0" />
                  <span className="text-left">Send Invoice</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 justify-start bg-transparent h-auto py-2 ${selectedTemplate === "status_update" ? "border-primary" : ""}`}
                  onClick={() => selectTemplate("status_update")}
                >
                  <Bell size={14} className="shrink-0" />
                  <span className="text-left">Status Update</span>
                </Button>
              </div>
            </div>

            {/* Template Preview or Custom Email */}
            {templatePreview ? (
              <div>
                <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
                  Email Preview
                </Label>
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Subject</p>
                    <p className="text-sm font-medium">{templatePreview.subject}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Body</p>
                    <p className="text-sm whitespace-pre-wrap">{templatePreview.text}</p>
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <Button variant="ghost" size="sm" onClick={clearTemplate}>
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
                    Subject
                  </Label>
                  <Input
                    placeholder="Email subject..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
                    Message
                  </Label>
                  <Textarea
                    placeholder="Type your email message..."
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email will be wrapped in your shop branded template with footer.
                  </p>
                </div>
              </div>
            )}

            {/* Send Result */}
            {sendResult && (
              <div
                className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                  sendResult.success
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {sendResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {sendResult.message}
              </div>
            )}

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={sending || !hasContent}
              className="w-full gap-2"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {sending ? "Sending..." : "Send Email"}
            </Button>
          </>
        )}

        {/* Email History */}
        <div>
          <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
            Recent Emails
          </Label>
          {loadingHistory ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No emails yet</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((msg) => {
                const StatusIcon = STATUS_CONFIG[msg.status]?.icon || Clock
                const statusColor = STATUS_CONFIG[msg.status]?.color || "text-muted-foreground"
                const ChannelIcon = msg.channel === "email" ? Mail : MessageSquare
                return (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg border border-border text-sm ${
                      msg.direction === "inbound" ? "bg-primary/5 ml-4" : "bg-muted/30 mr-4"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <ChannelIcon size={10} className="text-muted-foreground" />
                        <Badge variant="outline" className="text-[10px] py-0">
                          {MESSAGE_TYPE_LABELS[msg.message_type] || msg.message_type}
                        </Badge>
                        <StatusIcon size={12} className={statusColor} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {msg.subject && (
                      <p className="text-xs font-medium text-foreground truncate">{msg.subject}</p>
                    )}
                    <p className="text-xs text-foreground/70 line-clamp-2">{msg.message_body}</p>
                    {msg.error_message && (
                      <p className="text-[10px] text-destructive mt-1">{msg.error_message}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

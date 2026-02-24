"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  MessageSquare,
  Send,
  FileText,
  Truck,
  Bell,
  ThumbsUp,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { formatPhoneNumber } from "@/lib/utils/phone-format"

interface SMSDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: number
  customerName: string
  phone: string
  workOrderId: number
  roNumber: string
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  grandTotal?: number
}

interface SMSMessage {
  id: number
  message_body: string
  message_type: string
  status: string
  direction: string
  created_at: string
  error_message?: string
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  estimate_link: "Estimate",
  status_update: "Status Update",
  pickup_ready: "Pickup Ready",
  appointment_reminder: "Reminder",
  approval_request: "Approval",
  custom: "Custom",
  inbound_reply: "Reply",
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string }> = {
  queued: { icon: Clock, color: "text-muted-foreground" },
  sent: { icon: Send, color: "text-blue-500" },
  delivered: { icon: CheckCircle, color: "text-green-500" },
  failed: { icon: XCircle, color: "text-destructive" },
  undelivered: { icon: AlertTriangle, color: "text-amber-500" },
  received: { icon: MessageSquare, color: "text-primary" },
}

export function SMSDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  phone,
  workOrderId,
  roNumber,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  grandTotal,
}: SMSDialogProps) {
  const [customMessage, setCustomMessage] = useState("")
  const [preview, setPreview] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)
  const [history, setHistory] = useState<SMSMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [smsOptedOut, setSmsOptedOut] = useState(false)
  const [consentLoading, setConsentLoading] = useState(false)
  const [shopName, setShopName] = useState('Our Shop')

  const vehicleYMM = `${vehicleYear} ${vehicleMake} ${vehicleModel}`
  const firstName = customerName.split(" ")[0]

  // Fetch shop profile on mount
  useEffect(() => {
    fetch('/api/settings/shop-profile')
      .then(r => r.json())
      .then(data => { if (data?.profile?.shop_name) setShopName(data.profile.shop_name) })
      .catch(() => { /* uses default values on failure */ })
  }, [])

  // Fetch SMS consent status and history when dialog opens
  useEffect(() => {
    if (!open) return

    const fetchData = async () => {
      // Fetch consent status
      try {
        const res = await fetch(`/api/customers/${customerId}`)
        if (res.ok) {
          const data = await res.json()
          setSmsConsent(data.customer.sms_consent || false)
          setSmsOptedOut(data.customer.sms_opted_out || false)
        }
      } catch { toast.error('Failed to load customer details') }

      // Fetch SMS history
      setLoadingHistory(true)
      try {
        const res = await fetch(`/api/sms/history?workOrderId=${workOrderId}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setHistory(data.messages || [])
        }
      } catch { toast.error('Failed to load message history') }
      setLoadingHistory(false)
    }

    fetchData()
    setSendResult(null)
    setPreview("")
    setCustomMessage("")
  }, [open, customerId, workOrderId])

  const handleConsentToggle = useCallback(async (checked: boolean) => {
    setConsentLoading(true)
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sms_consent: checked }),
      })
      if (res.ok) {
        setSmsConsent(checked)
        if (checked) setSmsOptedOut(false)
      }
    } catch { toast.error('Failed to load consent status') }
    setConsentLoading(false)
  }, [customerId])

  const selectTemplate = useCallback(
    async (templateId: string) => {
      let body = ""
      switch (templateId) {
        case "estimate_link": {
          // Fetch tokenized estimate URL — never expose bare work order IDs
          let estimateUrl = ""
          try {
            const res = await fetch(`/api/work-orders/${workOrderId}/estimate/latest`)
            if (res.ok) {
              const data = await res.json()
              estimateUrl = data.estimate.url
            }
          } catch { toast.error('Failed to load estimate link') }
          if (!estimateUrl) {
            estimateUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/estimates/${workOrderId}`
          }
          body = `Hi ${firstName}, your estimate for your ${vehicleYMM} is ready. View it here: ${estimateUrl} - ${shopName}. Reply STOP to opt out.`
          break
        }
        case "pickup_ready":
          body = `Good news! Your ${vehicleYMM} is ready for pickup. Your total is $${(grandTotal || 0).toFixed(2)}. - ${shopName}. Reply STOP to opt out.`
          break
        case "status_update":
          body = `Update on your ${vehicleYMM}: Your vehicle is currently being serviced. - ${shopName}. Reply STOP to opt out.`
          break
        case "approval_request":
          body = `Hi ${firstName}, we found additional services needed for your ${vehicleYMM}. Reply YES to approve or NO to decline. - ${shopName}. Reply STOP to opt out.`
          break
      }
      setPreview(body)
      setCustomMessage("")
    },
    [firstName, vehicleYMM, workOrderId, grandTotal, shopName]
  )

  const handleSend = useCallback(async () => {
    const body = preview || customMessage
    if (!body.trim()) return

    setSending(true)
    setSendResult(null)

    try {
      const messageType = preview ? "template" : "custom"
      const finalBody = customMessage
        ? `${customMessage} - ${shopName}. Reply STOP to opt out.`
        : body

      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          body: finalBody,
          workOrderId,
          customerId,
          messageType,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSendResult({ success: false, message: data.error || "Failed to send" })
      } else {
        setSendResult({
          success: true,
          message: data.dryRun ? "Message logged (dry run mode)" : "Message sent successfully",
        })
        setPreview("")
        setCustomMessage("")

        // Refresh history
        const histRes = await fetch(`/api/sms/history?workOrderId=${workOrderId}&limit=10`)
        if (histRes.ok) {
          const histData = await histRes.json()
          setHistory(histData.messages || [])
        }
      }
    } catch (error: any) {
      setSendResult({ success: false, message: error.message || "Failed to send" })
    }

    setSending(false)
  }, [preview, customMessage, phone, workOrderId, customerId, shopName])

  const canSend = smsConsent && !smsOptedOut

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={18} />
            Send SMS to {customerName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatPhoneNumber(phone)} &middot; {roNumber}
          </p>
        </DialogHeader>

        {/* SMS Consent Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div>
            <Label className="text-sm font-medium">SMS Opt-in</Label>
            <p className="text-xs text-muted-foreground">
              {smsOptedOut
                ? "Customer has opted out via STOP"
                : smsConsent
                ? "Customer consented to SMS"
                : "Customer must opt in before sending"}
            </p>
          </div>
          <Switch
            checked={smsConsent}
            onCheckedChange={handleConsentToggle}
            disabled={consentLoading || smsOptedOut}
          />
        </div>

        {smsOptedOut && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
            <AlertTriangle size={14} />
            Customer opted out. They must text START to re-subscribe.
          </div>
        )}

        {/* Quick Templates */}
        {canSend && (
          <>
            <div>
              <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
                Quick Messages
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start bg-transparent h-auto py-2"
                  onClick={() => selectTemplate("estimate_link")}
                >
                  <FileText size={14} className="shrink-0" />
                  <span className="text-left">Send Estimate</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start bg-transparent h-auto py-2"
                  onClick={() => selectTemplate("pickup_ready")}
                >
                  <Truck size={14} className="shrink-0" />
                  <span className="text-left">Ready for Pickup</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start bg-transparent h-auto py-2"
                  onClick={() => selectTemplate("status_update")}
                >
                  <Bell size={14} className="shrink-0" />
                  <span className="text-left">Status Update</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start bg-transparent h-auto py-2"
                  onClick={() => selectTemplate("approval_request")}
                >
                  <ThumbsUp size={14} className="shrink-0" />
                  <span className="text-left">Approval Request</span>
                </Button>
              </div>
            </div>

            {/* Preview or Custom Message */}
            {preview ? (
              <div>
                <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
                  Message Preview
                </Label>
                <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm whitespace-pre-wrap">
                  {preview}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    {preview.length} / 160 characters
                    {preview.length > 160 && ` (${Math.ceil(preview.length / 153)} segments)`}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setPreview("")}>
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
                  Custom Message
                </Label>
                <Textarea
                  placeholder="Type your message..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Business name and opt-out language will be appended automatically.
                </p>
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
              disabled={sending || (!preview && !customMessage.trim())}
              className="w-full gap-2"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {sending ? "Sending..." : "Send SMS"}
            </Button>
          </>
        )}

        {/* SMS History */}
        <div>
          <Label className="text-xs uppercase text-muted-foreground tracking-wide mb-2 block">
            Recent Messages
          </Label>
          {loadingHistory ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((msg) => {
                const StatusIcon = STATUS_CONFIG[msg.status]?.icon || Clock
                const statusColor = STATUS_CONFIG[msg.status]?.color || "text-muted-foreground"
                return (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg border border-border text-sm ${
                      msg.direction === "inbound" ? "bg-primary/5 ml-4" : "bg-muted/30 mr-4"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
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
                    <p className="text-xs text-foreground line-clamp-2">{msg.message_body}</p>
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

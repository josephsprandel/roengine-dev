"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
  Loader2,
  MessageSquare,
  Mail,
  Send,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  Link2,
} from "lucide-react"

type Channel = "sms" | "email" | "both"

interface SendToCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: number
  customerId: number
  customerName: string
  phone: string | null
  email: string | null
  vehicleYear: number
  vehicleMake: string
  vehicleModel: string
  grandTotal: number
  roNumber: string
}

export function SendToCustomerDialog({
  open,
  onOpenChange,
  workOrderId,
  customerId,
  customerName,
  phone,
  email,
  vehicleYear,
  vehicleMake,
  vehicleModel,
  grandTotal,
  roNumber,
}: SendToCustomerDialogProps) {
  const [channel, setChannel] = useState<Channel>("both")
  const [estimateUrl, setEstimateUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [smsBody, setSmsBody] = useState("")
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [error, setError] = useState("")

  // SMS consent state
  const [smsConsent, setSmsConsent] = useState(false)
  const [smsOptedOut, setSmsOptedOut] = useState(false)
  const [consentLoading, setConsentLoading] = useState(false)
  const [shopName, setShopName] = useState('Our Shop')

  // Copy link state
  const [copied, setCopied] = useState(false)

  const firstName = customerName?.split(" ")[0] || "Customer"
  const vehicleYMM = `${vehicleYear} ${vehicleMake} ${vehicleModel}`
  const hasPhone = !!phone
  const hasEmail = !!email

  const smsSelected = channel === "sms" || channel === "both"
  const smsBlocked = smsSelected && (!smsConsent || smsOptedOut)

  // Determine default channel
  useEffect(() => {
    if (hasPhone && hasEmail) setChannel("both")
    else if (hasPhone) setChannel("sms")
    else if (hasEmail) setChannel("email")
  }, [hasPhone, hasEmail])

  // Fetch shop profile on mount
  useEffect(() => {
    fetch('/api/settings/shop-profile')
      .then(r => r.json())
      .then(data => { if (data?.profile?.shop_name) setShopName(data.profile.shop_name) })
      .catch(() => { /* uses default values on failure */ })
  }, [])

  // Fetch consent status when dialog opens
  useEffect(() => {
    if (!open || !customerId) return

    const fetchConsent = async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}`)
        if (res.ok) {
          const data = await res.json()
          setSmsConsent(data.customer.sms_consent || false)
          setSmsOptedOut(data.customer.sms_opted_out || false)
        }
      } catch {
        toast.error('Failed to load consent status')
      }
    }

    fetchConsent()
  }, [open, customerId])

  // Handle consent toggle
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
    } catch {}
    setConsentLoading(false)
  }, [customerId])

  // On open: fetch or generate estimate, then populate message previews
  useEffect(() => {
    if (!open) {
      setSent(false)
      setError("")
      setCopied(false)
      return
    }

    const initEstimate = async () => {
      setLoading(true)
      setError("")
      setSent(false)

      try {
        const authToken = localStorage.getItem("auth_token")
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        }

        // Try to get existing active estimate
        let url = ""
        const latestRes = await fetch(
          `/api/work-orders/${workOrderId}/estimate/latest`,
          { headers }
        )

        if (latestRes.ok) {
          const data = await latestRes.json()
          url = data.estimate.url
        } else {
          // Auto-generate a new estimate
          const autoRes = await fetch(
            `/api/work-orders/${workOrderId}/estimate/auto`,
            { method: "POST", headers }
          )

          if (!autoRes.ok) {
            const errData = await autoRes.json()
            throw new Error(errData.error || "Failed to generate estimate")
          }

          const data = await autoRes.json()
          url = data.url
        }

        setEstimateUrl(url)

        // Pre-fill SMS body
        setSmsBody(
          `Hi ${firstName}, your estimate for your ${vehicleYMM} is ready. View it here: ${url} - ${shopName}. Reply STOP to opt out.`
        )

        // Pre-fill email fields
        setEmailSubject(`Your Estimate is Ready — ${vehicleYMM}`)
        setEmailBody(
          `Hi ${firstName},\n\nYour estimate for your ${vehicleYMM} is ready for review.\n\nView your estimate here: ${url}\n\nIf you have any questions, give us a call!\n\n— ${shopName}`
        )
      } catch (err: any) {
        setError(err.message || "Failed to prepare estimate")
      } finally {
        setLoading(false)
      }
    }

    initEstimate()
  }, [open, workOrderId, firstName, vehicleYMM, shopName])

  // Copy estimate link
  const handleCopyLink = useCallback(async () => {
    if (!estimateUrl) return
    try {
      await navigator.clipboard.writeText(estimateUrl)
      setCopied(true)
      toast.success("Estimate link copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link")
    }
  }, [estimateUrl])

  const handleSend = useCallback(async () => {
    setSending(true)
    setError("")

    const authToken = localStorage.getItem("auth_token")
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }

    const results: string[] = []

    try {
      // Send SMS
      if (channel === "sms" || channel === "both") {
        if (!phone) {
          throw new Error("No phone number on file")
        }
        const smsRes = await fetch("/api/sms/send", {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: phone,
            body: smsBody,
            workOrderId,
            customerId,
            messageType: "estimate_link",
          }),
        })
        const smsData = await smsRes.json()
        if (!smsRes.ok) throw new Error(smsData.error || "SMS failed")
        results.push(smsData.dryRun ? "SMS logged (dry run)" : "SMS sent")
      }

      // Send Email
      if (channel === "email" || channel === "both") {
        if (!email) {
          throw new Error("No email address on file")
        }
        const emailRes = await fetch("/api/email/send", {
          method: "POST",
          headers,
          body: JSON.stringify({
            to: email,
            subject: emailSubject,
            body: emailBody,
            workOrderId,
            customerId,
            messageType: "estimate_ready",
            templateId: "estimate_ready",
            templateData: {
              customerName: firstName,
              vehicleYMM: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
              estimateUrl,
              total: grandTotal.toFixed(2),
            },
          }),
        })
        const emailData = await emailRes.json()
        if (!emailRes.ok) throw new Error(emailData.error || "Email failed")
        results.push(emailData.dryRun ? "Email logged (dry run)" : "Email sent")
      }

      // Log activity
      try {
        await fetch(`/api/work-orders/${workOrderId}/activity`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            actorType: "staff",
            action: `estimate_sent_${channel}`,
            description: `Estimate sent to customer via ${channel === "both" ? "SMS and email" : channel}`,
            metadata: { channel, estimateUrl, roNumber },
          }),
        })
      } catch {
        // Activity logging is non-critical
      }

      setSent(true)
      toast.success(results.join(", "))
    } catch (err: any) {
      setError(err.message || "Failed to send")
      toast.error(err.message || "Failed to send")
    } finally {
      setSending(false)
    }
  }, [channel, phone, email, smsBody, emailSubject, emailBody, workOrderId, customerId, firstName, vehicleYear, vehicleMake, vehicleModel, estimateUrl, grandTotal, roNumber])

  const channelOptions: { value: Channel; label: string; icon: typeof Send; available: boolean }[] = [
    { value: "sms", label: "SMS", icon: MessageSquare, available: hasPhone },
    { value: "email", label: "Email", icon: Mail, available: hasEmail },
    { value: "both", label: "Both", icon: Send, available: hasPhone && hasEmail },
  ]

  // Send is disabled when: nothing to send to, OR SMS is selected but consent is missing
  const sendDisabled = sending || (!hasPhone && !hasEmail) || smsBlocked

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Estimate to Customer</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Preparing estimate...</p>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="font-medium text-lg">Estimate Sent!</p>
            <p className="text-sm text-muted-foreground text-center">
              {channel === "both"
                ? `Sent via SMS to ${phone} and email to ${email}`
                : channel === "sms"
                  ? `Sent via SMS to ${phone}`
                  : `Sent via email to ${email}`}
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-4">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Estimate link with copy button */}
            {estimateUrl && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30 min-w-0">
                <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 font-mono">
                  {estimateUrl}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs flex-shrink-0"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Channel selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Send via</Label>
              <div className="flex gap-2">
                {channelOptions.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      onClick={() => opt.available && setChannel(opt.value)}
                      disabled={!opt.available}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        channel === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : opt.available
                            ? "border-border bg-card text-foreground hover:bg-accent/50"
                            : "border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {!hasPhone && !hasEmail && (
                <p className="text-xs text-destructive mt-1">
                  No phone or email on file for this customer
                </p>
              )}
            </div>

            {/* SMS Consent — shown when SMS channel is selected */}
            {smsSelected && hasPhone && (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <Label className="text-sm font-medium">SMS Opt-in</Label>
                    <p className="text-xs text-muted-foreground">
                      {smsOptedOut
                        ? "Customer has opted out via STOP"
                        : smsConsent
                        ? "Customer consented to SMS"
                        : "Customer must opt in before sending SMS"}
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
              </>
            )}

            {/* SMS Preview */}
            {smsSelected && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">SMS Message</Label>
                  <Badge variant="secondary" className="text-xs">{phone}</Badge>
                </div>
                <textarea
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {smsBody.length} characters
                  {smsBody.length > 160 ? ` (${Math.ceil(smsBody.length / 153)} segments)` : ""}
                </p>
              </div>
            )}

            {/* Email Preview */}
            {(channel === "email" || channel === "both") && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Email</Label>
                  <Badge variant="secondary" className="text-xs">{email}</Badge>
                </div>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full px-3 py-2 mb-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be sent as a branded HTML email
                </p>
              </div>
            )}

            {/* Send button */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sendDisabled}
                className="flex-1 gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Estimate
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

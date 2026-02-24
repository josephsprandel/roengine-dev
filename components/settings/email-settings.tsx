"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Loader2, CheckCircle, XCircle, Save } from "lucide-react"
import { toast } from "sonner"

interface EmailSettings {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_from_email: string
  imap_host: string
  imap_port: number
  imap_user: string
  imap_password: string
}

const DEFAULT_SETTINGS: EmailSettings = {
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  smtp_from_email: "",
  imap_host: "",
  imap_port: 993,
  imap_user: "",
  imap_password: "",
}

export function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testingImap, setTestingImap] = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [imapTestResult, setImapTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/email")
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
    } catch {
      toast.error("Failed to load email settings")
    }
    setLoading(false)
  }

  const handleChange = (field: keyof EmailSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast.success("Email settings saved")
        setHasChanges(false)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to save settings")
      }
    } catch {
      toast.error("Failed to save settings")
    }
    setSaving(false)
  }

  const testConnection = async (type: "smtp" | "imap") => {
    const isSmtp = type === "smtp"
    const setTesting = isSmtp ? setTestingSmtp : setTestingImap
    const setResult = isSmtp ? setSmtpTestResult : setImapTestResult

    setTesting(true)
    setResult(null)

    try {
      const payload = isSmtp
        ? { type: "smtp", host: settings.smtp_host, port: settings.smtp_port, user: settings.smtp_user, password: settings.smtp_password }
        : { type: "imap", host: settings.imap_host, port: settings.imap_port, user: settings.imap_user, password: settings.imap_password }

      const res = await fetch("/api/settings/email/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      setResult({
        success: data.success,
        message: data.success ? data.message : data.error,
      })
    } catch {
      setResult({ success: false, message: "Connection test failed" })
    }

    setTesting(false)
  }

  if (loading) {
    return (
      <Card className="p-8 border-border flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 mb-6">
          <Mail size={20} className="text-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Email Configuration</h2>
            <p className="text-sm text-muted-foreground">Configure SMTP for sending and IMAP for receiving emails</p>
          </div>
        </div>

        {/* SMTP Section */}
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
            SMTP — Outbound Email
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">SMTP Host</Label>
              <Input
                placeholder="smtp.gmail.com"
                value={settings.smtp_host}
                onChange={(e) => handleChange("smtp_host", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">SMTP Port</Label>
              <Input
                type="number"
                placeholder="587"
                value={settings.smtp_port}
                onChange={(e) => handleChange("smtp_port", parseInt(e.target.value) || 587)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">465 for SSL, 587 for TLS</p>
            </div>
            <div>
              <Label className="text-sm">Username</Label>
              <Input
                placeholder="your-email@domain.com"
                value={settings.smtp_user}
                onChange={(e) => handleChange("smtp_user", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Password</Label>
              <Input
                type="password"
                placeholder={settings.smtp_password === "***" ? "Password is set" : "Enter password"}
                value={settings.smtp_password === "***" ? "" : settings.smtp_password}
                onChange={(e) => handleChange("smtp_password", e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-sm">From Email Address</Label>
              <Input
                placeholder="service@autohousenwa.com"
                value={settings.smtp_from_email}
                onChange={(e) => handleChange("smtp_from_email", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">The email address shown as the sender</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent gap-2"
              onClick={() => testConnection("smtp")}
              disabled={testingSmtp || !settings.smtp_host || !settings.smtp_user}
            >
              {testingSmtp ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Test SMTP Connection
            </Button>
            {smtpTestResult && (
              <div className={`flex items-center gap-1.5 text-sm ${smtpTestResult.success ? "text-green-600" : "text-destructive"}`}>
                {smtpTestResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {smtpTestResult.message}
              </div>
            )}
          </div>
        </div>

        {/* IMAP Section */}
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
            IMAP — Inbound Email
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">IMAP Host</Label>
              <Input
                placeholder="imap.gmail.com"
                value={settings.imap_host}
                onChange={(e) => handleChange("imap_host", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">IMAP Port</Label>
              <Input
                type="number"
                placeholder="993"
                value={settings.imap_port}
                onChange={(e) => handleChange("imap_port", parseInt(e.target.value) || 993)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">993 for SSL (standard)</p>
            </div>
            <div>
              <Label className="text-sm">Username</Label>
              <Input
                placeholder="your-email@domain.com"
                value={settings.imap_user}
                onChange={(e) => handleChange("imap_user", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm">Password</Label>
              <Input
                type="password"
                placeholder={settings.imap_password === "***" ? "Password is set" : "Enter password"}
                value={settings.imap_password === "***" ? "" : settings.imap_password}
                onChange={(e) => handleChange("imap_password", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent gap-2"
              onClick={() => testConnection("imap")}
              disabled={testingImap || !settings.imap_host || !settings.imap_user}
            >
              {testingImap ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Test IMAP Connection
            </Button>
            {imapTestResult && (
              <div className={`flex items-center gap-1.5 text-sm ${imapTestResult.success ? "text-green-600" : "text-destructive"}`}>
                {imapTestResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {imapTestResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {hasChanges ? "You have unsaved changes" : "All changes saved"}
          </p>
          <Button onClick={handleSave} disabled={saving || !hasChanges} className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </Card>
    </div>
  )
}

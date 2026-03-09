"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Save, Loader2, Clock } from "lucide-react"
import { toast } from "sonner"

interface DayHours {
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

export function BusinessHoursSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hours, setHours] = useState<DayHours[]>([])

  useEffect(() => {
    fetch("/api/scheduling/business-hours")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.hours) {
          setHours(data.hours.map((h: any) => ({
            day_of_week: h.day_of_week,
            is_open: h.is_open,
            open_time: h.open_time ? h.open_time.substring(0, 5) : "07:00",
            close_time: h.close_time ? h.close_time.substring(0, 5) : "18:00",
          })))
        }
      })
      .catch(() => toast.error("Failed to load business hours"))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/scheduling/business-hours", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ hours }),
      })
      if (res.ok) {
        toast.success("Business hours saved")
      } else {
        toast.error("Failed to save business hours")
      }
    } catch {
      toast.error("Failed to save business hours")
    } finally {
      setSaving(false)
    }
  }

  const updateDay = (dayName: string, field: keyof DayHours, value: any) => {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayName ? { ...h, [field]: value } : h
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin mr-2 text-muted-foreground" size={20} />
        <span className="text-muted-foreground">Loading business hours...</span>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} className="text-purple-500" />
        <h3 className="font-semibold text-foreground">Business Hours</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Operating hours used by the scheduling engine and online booking.
      </p>

      <div className="space-y-2">
        {/* Header */}
        <div className="grid grid-cols-[120px_60px_120px_120px] gap-3 text-xs font-medium text-muted-foreground px-1">
          <span>Day</span>
          <span>Open</span>
          <span>Open Time</span>
          <span>Close Time</span>
        </div>

        {hours.map(h => (
          <div
            key={h.day_of_week}
            className={`grid grid-cols-[120px_60px_120px_120px] gap-3 items-center rounded-md p-2 ${
              h.is_open ? "bg-muted/50" : "bg-muted/20 opacity-60"
            }`}
          >
            <span className="text-sm font-medium">{h.day_of_week}</span>
            <Switch
              checked={h.is_open}
              onCheckedChange={v => updateDay(h.day_of_week, "is_open", v)}
            />
            <Input
              type="time"
              value={h.open_time || "07:00"}
              onChange={e => updateDay(h.day_of_week, "open_time", e.target.value)}
              disabled={!h.is_open}
              className="h-8 text-xs"
            />
            <Input
              type="time"
              value={h.close_time || "18:00"}
              onChange={e => updateDay(h.day_of_week, "close_time", e.target.value)}
              disabled={!h.is_open}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : <><Save size={16} className="mr-2" />Save Business Hours</>}
        </Button>
      </div>
    </Card>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Save } from "lucide-react"

interface FeedSettings {
  visible: boolean
  defaultCount: number
  filters: Record<string, boolean>
}

const EVENT_TYPES = [
  { key: "customer_viewed_estimate", label: "Customer viewed estimate" },
  { key: "customer_approved_services", label: "Customer approved services" },
  { key: "estimate_sent_email", label: "Estimate sent (email)" },
  { key: "estimate_sent_sms", label: "Estimate sent (SMS)" },
  { key: "estimate_sent_both", label: "Estimate sent (both)" },
  { key: "estimate_generated", label: "Estimate generated" },
  { key: "recommendations_reviewed", label: "Recommendations reviewed" },
  { key: "ro_created", label: "RO created" },
  { key: "staff_viewed_estimate_link", label: "Staff viewed estimate link" },
]

const COUNT_OPTIONS = [3, 5, 10] as const

const DEFAULT_SETTINGS: FeedSettings = {
  visible: true,
  defaultCount: 3,
  filters: {},
}

function loadSettings(): FeedSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem("global_feed_settings")
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

export function UISettings() {
  const [settings, setSettings] = useState<FeedSettings>(DEFAULT_SETTINGS)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const update = (patch: Partial<FeedSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const toggleFilter = (key: string) => {
    setSettings((prev) => {
      const filters = { ...prev.filters }
      if (filters[key]) {
        delete filters[key]
      } else {
        filters[key] = true
      }
      return { ...prev, filters }
    })
    setDirty(true)
  }

  const save = () => {
    localStorage.setItem("global_feed_settings", JSON.stringify(settings))
    setDirty(false)
    toast.success("UI settings saved")
  }

  const activeFilterCount = Object.values(settings.filters).filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Global Activity Feed */}
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-1">Global Activity Feed</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure the live activity feed on the dashboard.
        </p>

        <div className="space-y-6">
          {/* Visible toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show activity feed</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Display the live activity feed on the dashboard
              </p>
            </div>
            <Switch
              checked={settings.visible}
              onCheckedChange={(checked) => update({ visible: checked })}
            />
          </div>

          {/* Default event count */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Default events shown</Label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  onClick={() => update({ defaultCount: count })}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    settings.defaultCount === count
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-accent/50"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Event type filters */}
          <div>
            <Label className="text-sm font-medium mb-1 block">Event type filter</Label>
            <p className="text-xs text-muted-foreground mb-3">
              {activeFilterCount === 0
                ? "Showing all event types. Check specific types to filter."
                : `Showing ${activeFilterCount} selected type${activeFilterCount > 1 ? "s" : ""} only.`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENT_TYPES.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!settings.filters[key]}
                    onChange={() => toggleFilter(key)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty} className="gap-2">
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}

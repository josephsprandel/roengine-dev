"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Activity, ChevronDown, ChevronUp } from "lucide-react"
import { format } from "date-fns"
import { useTransferNotifications, type GlobalActivityEvent } from "@/contexts/transfer-notifications-context"
import { useRouter } from "next/navigation"

// ── Color classification ──────────────────────────────────────────────
type EventColor = "green" | "blue" | "amber"

const GREEN_ACTIONS = new Set([
  "customer_viewed_estimate",
  "customer_approved_services",
  "customer_responded",
  "ro_created", // online booking
])

const AMBER_ACTIONS = new Set([
  "phone_call_received",
  "customer_replied_sms",
  "sms_received",
  "inbound_call",
])

function getEventColor(event: GlobalActivityEvent): EventColor {
  if (GREEN_ACTIONS.has(event.action)) return "green"
  if (AMBER_ACTIONS.has(event.action)) return "amber"
  // Online bookings by customer
  if (event.action === "ro_created" && event.actor_type === "customer") return "green"
  return "blue"
}

const colorStyles: Record<EventColor, { border: string; bg: string; dot: string }> = {
  green: {
    border: "border-l-green-500",
    bg: "bg-green-50/50 dark:bg-green-950/10",
    dot: "bg-green-500",
  },
  blue: {
    border: "border-l-blue-500",
    bg: "bg-blue-50/50 dark:bg-blue-950/10",
    dot: "bg-blue-500",
  },
  amber: {
    border: "border-l-amber-500",
    bg: "bg-amber-50/50 dark:bg-amber-950/10",
    dot: "bg-amber-500",
  },
}

// ── Human-readable event formatting ───────────────────────────────────
function formatEvent(event: GlobalActivityEvent): string {
  const customer = event.customer_name || "Unknown"
  const ro = event.ro_number || "—"
  const actor = event.actor_name

  switch (event.action) {
    case "customer_viewed_estimate":
      return `Customer ${customer} viewed ${ro}`
    case "customer_approved_services":
      return `Customer ${customer} approved services on ${ro}`
    case "customer_responded":
      return `Customer ${customer} responded on ${ro}`
    case "estimate_sent_email":
      return `${actor || "Staff"} sent estimate to ${customer} on ${ro}`
    case "estimate_sent_sms":
      return `${actor || "Staff"} sent estimate to ${customer} on ${ro}`
    case "estimate_sent_both":
      return `${actor || "Staff"} sent estimate to ${customer} on ${ro}`
    case "estimate_generated":
      return `${actor || "Staff"} generated estimate for ${ro}`
    case "recommendations_reviewed":
      return `${actor || "Staff"} approved recommendations for ${customer} on ${ro}`
    case "ro_created": {
      const source = event.metadata?.source
      if (source === "online_booking") {
        return `${customer} booked online — ${ro} created`
      }
      return `${ro} created for ${customer}`
    }
    case "staff_viewed_estimate_link":
      return `${actor || "Staff"} viewed estimate link for ${ro}`
    case "phone_call_received":
      return `Inbound call on ${ro}`
    default:
      // Fallback: use the raw description
      return event.description
  }
}

function formatTime(dateStr: string): string {
  return format(new Date(dateStr), "h:mma").toLowerCase()
}

// ── Settings hook (localStorage-backed) ──────────────────────────────
interface FeedSettings {
  visible: boolean
  defaultCount: number
  filters: Record<string, boolean>
}

const DEFAULT_SETTINGS: FeedSettings = {
  visible: true,
  defaultCount: 3,
  filters: {},
}

function useFeedSettings(): FeedSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem("global_feed_settings")
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS
}

// ── Component ─────────────────────────────────────────────────────────
export function GlobalActivityFeed() {
  const { globalActivity } = useTransferNotifications()
  const settings = useFeedSettings()
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()

  // Apply filters from settings
  const filtered = useMemo(() => {
    if (!settings.filters || Object.keys(settings.filters).length === 0) return globalActivity
    const activeFilters = Object.entries(settings.filters).filter(([, v]) => v).map(([k]) => k)
    if (activeFilters.length === 0) return globalActivity
    return globalActivity.filter((e) => activeFilters.includes(e.action))
  }, [globalActivity, settings.filters])

  if (!settings.visible) return null

  const displayCount = expanded ? 100 : settings.defaultCount
  const shown = filtered.slice(0, displayCount)
  const hasMore = filtered.length > settings.defaultCount

  return (
    <Card className="p-6 border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground">LIVE ACTIVITY</h3>
        </div>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show all ({filtered.length}) <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </div>

      {/* Events */}
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No activity recorded yet
        </p>
      ) : (
        <div className="space-y-1.5">
          {shown.map((event) => {
            const color = getEventColor(event)
            const styles = colorStyles[color]

            return (
              <button
                key={event.id}
                onClick={() => router.push(`/repair-orders/${event.work_order_id}`)}
                className={`w-full text-left flex items-start gap-3 px-3 py-2 rounded-md border-l-[3px] transition-colors hover:bg-muted/40 cursor-pointer ${styles.border} ${styles.bg}`}
              >
                {/* Color dot */}
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${styles.dot}`} />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">
                    {formatEvent(event)}
                  </p>
                </div>

                {/* Timestamp */}
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                  {formatTime(event.created_at)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

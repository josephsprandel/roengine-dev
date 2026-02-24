"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  ChevronRight,
  User,
  UserCircle,
  Settings,
  Loader2,
  Activity,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

interface ActivityEntry {
  id: number
  work_order_id: number
  user_id: number | null
  actor_type: "staff" | "customer" | "system"
  action: string
  description: string
  metadata: Record<string, any> | null
  created_at: string
  user_name: string | null
  grouped?: boolean
  group_count?: number
  group_start?: string
  group_end?: string
}

interface ActivityLogProps {
  workOrderId: number
}

const actorIcons: Record<string, typeof User> = {
  staff: User,
  customer: UserCircle,
  system: Settings,
}

const actorColors: Record<string, string> = {
  staff: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  customer: "bg-green-500/20 text-green-600 dark:text-green-400",
  system: "bg-muted text-muted-foreground",
}

export function ActivityLog({ workOrderId }: ActivityLogProps) {
  const [expanded, setExpanded] = useState(false)
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!expanded || fetched) return

    const fetchActivities = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/work-orders/${workOrderId}/activity?limit=50`)
        if (res.ok) {
          const data = await res.json()
          setActivities(data.activities || [])
          setTotal(data.pagination?.total || 0)
        }
      } catch (err) {
        console.error("Failed to fetch activity log:", err)
      } finally {
        setLoading(false)
        setFetched(true)
      }
    }

    fetchActivities()
  }, [expanded, fetched, workOrderId])

  // Refresh when expanded again after initial fetch
  const handleToggle = () => {
    if (!expanded) {
      setFetched(false) // re-fetch on next expand
    }
    setExpanded(!expanded)
  }

  const formatGroupedDateRange = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    if (s.toDateString() === e.toDateString()) {
      return format(s, "MMM d")
    }
    return `${format(s, "MMM d")}–${format(e, "MMM d")}`
  }

  return (
    <Card className="p-6 border-border">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 w-full text-left hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Activity className="h-5 w-5 text-muted-foreground" />
        <span className="font-semibold text-lg">Activity Log</span>
        {total > 0 && (
          <Badge variant="secondary">{total}</Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading activity...</span>
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No activity recorded yet
            </p>
          ) : (
            <div className="space-y-1">
              {activities.map((entry) => {
                const Icon = actorIcons[entry.actor_type] || Settings
                const colorClass = actorColors[entry.actor_type] || actorColors.system
                const timestamp = new Date(entry.created_at)

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    {/* Actor icon */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${colorClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-foreground">
                          {entry.user_name && entry.actor_type === "staff" && (
                            <span className="font-medium">{entry.user_name} — </span>
                          )}
                          {entry.description}
                        </span>
                      </div>
                      {entry.grouped && entry.group_start && entry.group_end && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Between {formatGroupedDateRange(entry.group_start, entry.group_end)}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span
                      className="text-xs text-muted-foreground flex-shrink-0 mt-0.5"
                      title={format(timestamp, "PPpp")}
                    >
                      {formatDistanceToNow(timestamp, { addSuffix: true })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

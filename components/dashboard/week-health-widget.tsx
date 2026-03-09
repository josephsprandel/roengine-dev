"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, Activity, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react"
import type { WeekAvailability } from "@/lib/scheduling/types"

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

export function WeekHealthWidget() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<WeekAvailability | null>(null)

  useEffect(() => {
    const monday = getMonday(new Date())
    fetch(`/api/scheduling/week-availability?week=${monday}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin mr-2 text-muted-foreground" size={20} />
          <span className="text-sm text-muted-foreground">Loading week health...</span>
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground text-center py-4">
          Unable to load week health data
        </p>
      </Card>
    )
  }

  const score = data.health_score
  const grade = data.health_grade
  const scoreColor =
    score >= 70 ? "text-green-600" :
    score >= 40 ? "text-amber-600" :
    "text-red-600"
  const progressColor =
    score >= 70 ? "[&>div]:bg-green-500" :
    score >= 40 ? "[&>div]:bg-amber-500" :
    "[&>div]:bg-red-500"
  const gradeVariant =
    score >= 70 ? "default" :
    score >= 40 ? "secondary" :
    "destructive"

  const weekCeiling = data.total_tech_hour_ceiling || 80
  const techPct = Math.round((data.total_tech_hours_committed / weekCeiling) * 100)

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Week Health
          </h3>
        </div>
        <Badge variant={gradeVariant as any} className="text-xs">
          {grade} ({score})
        </Badge>
      </div>

      {/* Health Score Bar */}
      <Progress value={score} className={`h-2.5 mb-4 ${progressColor}`} />

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
        <MetricRow
          label="Tech Hours"
          value={`${data.total_tech_hours_committed.toFixed(0)} / ${weekCeiling}`}
          sub={`${techPct}% utilized`}
          status={techPct > 100 ? "danger" : techPct > 85 ? "warn" : "ok"}
        />
        <MetricRow
          label="Large Jobs"
          value={`${data.big_job_count} / 4 slots`}
          status={data.big_job_count > 4 ? "danger" : data.big_job_count >= 3 ? "warn" : "ok"}
        />
        <MetricRow
          label="Week-Killer"
          value={data.week_killer_count > 0 ? `Active (${data.week_killer_count})` : "None"}
          status={data.week_killer_count > 2 ? "danger" : data.week_killer_count > 0 ? "warn" : "ok"}
        />
        <MetricRow
          label="Friday"
          value={data.friday_new_appointments > 2 ? "At Risk" : "Protected"}
          status={data.friday_new_appointments > 2 ? "danger" : "ok"}
        />
        <MetricRow
          label="Drop-off Slots"
          value={`${data.available_dropoff_slots} remaining`}
          status={data.available_dropoff_slots < 5 ? "warn" : "ok"}
        />
        <MetricRow
          label="Waiter Ratio"
          value={data.total_appointments > 0
            ? `${Math.round((data.waiter_count / data.total_appointments) * 100)}%`
            : "0%"
          }
          sub={`${data.waiter_count} of ${data.total_appointments}`}
          status={
            data.total_appointments > 0 && (data.waiter_count / data.total_appointments) > 0.30
              ? "warn"
              : "ok"
          }
        />
      </div>

      {/* Health Flags */}
      {data.health_flags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          {data.health_flags.map((flag, i) => {
            const isRed = flag.includes("CRITICAL") || flag.includes("OVERLOADED")
            return (
              <div key={i} className={`flex items-start gap-1.5 text-xs ${isRed ? "text-red-600" : "text-amber-600"}`}>
                {isRed ? <ShieldAlert size={12} className="mt-0.5 shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
                <span>{flag}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function MetricRow({
  label, value, sub, status,
}: {
  label: string
  value: string
  sub?: string
  status: "ok" | "warn" | "danger"
}) {
  const statusIcon =
    status === "danger" ? <ShieldAlert size={12} className="text-red-500 shrink-0" /> :
    status === "warn" ? <AlertTriangle size={12} className="text-amber-500 shrink-0" /> :
    <ShieldCheck size={12} className="text-green-500 shrink-0" />

  return (
    <div className="flex items-start gap-1.5">
      <div className="mt-0.5">{statusIcon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

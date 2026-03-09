"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, Phone, Clock, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface Appointment {
  id: number
  ro_number: string
  state: string
  scheduled_start: string
  scheduled_end: string
  customer_name: string
  customer_id?: number
  year: number
  make: string
  model: string
  services_summary: string | null
  service_count: number
  booking_source?: string | null
  appointment_type?: string | null
  job_state_name?: string | null
  job_state_color?: string | null
  tech_name: string | null
  is_waiter?: boolean
}

const STATUS_BORDER: Record<string, string> = {
  open: "border-l-green-500",
  approved: "border-l-green-500",
  estimate: "border-l-yellow-500",
  draft: "border-l-yellow-500",
  in_progress: "border-l-blue-500",
  waiting_on_parts: "border-l-yellow-500",
  waiting_approval: "border-l-yellow-500",
  completed: "border-l-green-500",
  cancelled: "border-l-red-500",
}

const STATE_BADGE_STYLE: Record<string, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  estimate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  waiting_on_parts: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  waiting_approval: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
}

const MAX_VISIBLE = 8

export function TodaysAppointments() {
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

    fetch(`/api/schedule?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.scheduled_orders) setAppointments(d.scheduled_orders) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const todayStr = format(now, "EEEE, MMMM d")
  const total = appointments.length
  const visible = appointments.slice(0, MAX_VISIBLE)
  const overflow = total - MAX_VISIBLE

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin mr-2 text-muted-foreground" size={20} />
          <span className="text-sm text-muted-foreground">Loading today&apos;s appointments...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Today&apos;s Appointments</h3>
          </div>
          <span className="text-sm text-muted-foreground">{todayStr}</span>
          {total > 0 && (
            <Badge variant="secondary" className="text-xs">
              {total} appointment{total !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Link
          href="/schedule"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View Full Schedule <ArrowRight size={14} />
        </Link>
      </div>

      {/* Appointments List */}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Calendar size={40} className="text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No appointments scheduled for today</p>
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus size={14} />
            Schedule Appointment
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((apt) => (
            <AppointmentRow key={apt.id} appointment={apt} now={now} />
          ))}

          {overflow > 0 && (
            <Link
              href="/schedule"
              className="block text-center text-sm text-primary hover:underline py-2"
            >
              and {overflow} more &rarr;
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}

function isPast(apt: Appointment, now: Date): boolean {
  if (!apt.scheduled_end) return false
  return new Date(apt.scheduled_end) < now
}

function AppointmentRow({ appointment: apt, now }: { appointment: Appointment; now: Date }) {
  const past = isPast(apt, now)
  const time = format(new Date(apt.scheduled_start), "h:mm a")
  const borderColor = STATUS_BORDER[apt.state] || "border-l-gray-300"
  const badgeStyle = STATE_BADGE_STYLE[apt.state] || "bg-gray-100 text-gray-600"
  const stateLabel = apt.job_state_name || apt.state.replace(/_/g, " ")
  const vehicle = [apt.year, apt.make, apt.model].filter(Boolean).join(" ")
  const services = apt.services_summary
    ? apt.services_summary.length > 60
      ? apt.services_summary.slice(0, 57) + "..."
      : apt.services_summary
    : apt.appointment_type || "—"

  return (
    <Link
      href={`/repair-orders/${apt.id}`}
      className={`block border-l-[3px] ${borderColor} rounded-md px-4 py-3 hover:bg-muted/40 transition-colors ${
        past ? "opacity-50" : ""
      }`}
    >
      {/* Desktop layout */}
      <div className="hidden sm:flex items-center gap-4">
        {/* Time */}
        <div className="flex items-center gap-1.5 w-24 shrink-0">
          <Clock size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium tabular-nums">{time}</span>
        </div>

        {/* Customer */}
        <div className="w-40 shrink-0 truncate">
          <span className="text-sm font-medium text-foreground">{apt.customer_name}</span>
        </div>

        {/* Vehicle */}
        <div className="w-44 shrink-0 truncate text-sm text-muted-foreground">
          {vehicle}
        </div>

        {/* Service */}
        <div className="flex-1 min-w-0 truncate text-sm text-muted-foreground">
          {services}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {apt.booking_source === "phone" && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Phone size={12} />
              AI Booked
            </span>
          )}
          {apt.is_waiter && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              Waiter
            </Badge>
          )}
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${badgeStyle}`}>
            {stateLabel}
          </span>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium tabular-nums">{time}</span>
            <span className="text-sm font-medium text-foreground">{apt.customer_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {apt.booking_source === "phone" && (
              <Phone size={12} className="text-emerald-600" />
            )}
            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${badgeStyle}`}>
              {stateLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
          <span>{vehicle}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="truncate">{services}</span>
        </div>
      </div>
    </Link>
  )
}

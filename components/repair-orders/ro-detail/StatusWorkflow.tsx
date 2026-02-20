"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronRight, Calendar, Clock, LucideIcon } from "lucide-react"
import { format } from "date-fns"
import { getIcon, jobStateBadgeStyle } from "@/lib/job-states"
import type { JobState } from "@/lib/job-states"

// Keep legacy interface for backward compatibility if needed
export interface WorkflowStage {
  id: string
  label: string
  icon: LucideIcon
  active: boolean
  completed: boolean
}

interface StatusWorkflowProps {
  jobStates: JobState[]
  currentStateId: number | null
  scheduledStart: string | null
  scheduledEnd: string | null
  onDateChange: (field: "scheduled_start" | "scheduled_end", value: string) => void
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatDisplay(iso: string | null): string {
  if (!iso) return "Not scheduled"
  return format(new Date(iso), "EEE, MMM d · h:mm a")
}

export function StatusWorkflow({
  jobStates,
  currentStateId,
  scheduledStart,
  scheduledEnd,
  onDateChange,
}: StatusWorkflowProps) {
  const [editingArrival, setEditingArrival] = useState(false)
  const [editingCompletion, setEditingCompletion] = useState(false)

  // Find current state index to determine completed/active/pending
  const currentIndex = jobStates.findIndex((s) => s.id === currentStateId)

  return (
    <Card className="p-4 border-border">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Dynamic job state pipeline */}
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {jobStates.map((state, idx) => {
            const Icon = getIcon(state.icon)
            const isCompleted = currentIndex >= 0 && idx < currentIndex
            const isActive = idx === currentIndex

            // Completed states: use the state's own color with full style
            // Active state: use the state's color with highlighted style
            // Pending states: muted
            let pillStyle: React.CSSProperties = {}
            let pillClass = "bg-muted text-muted-foreground"

            if (isCompleted) {
              pillStyle = {
                backgroundColor: `${state.color}25`,
                color: state.color,
              }
              pillClass = ""
            } else if (isActive) {
              pillStyle = jobStateBadgeStyle(state.color)
              pillClass = "ring-1"
            }

            return (
              <div key={state.id} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-transparent ${pillClass}`}
                  style={pillStyle}
                >
                  <Icon size={14} />
                  <span className="whitespace-nowrap">{state.name}</span>
                </div>
                {idx < jobStates.length - 1 && (
                  <ChevronRight size={14} className="text-border flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        {/* Right: Appointment dates */}
        <div className="flex items-center gap-4 lg:justify-end">
          {/* Arrival */}
          <div className="flex-1 lg:flex-initial">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide flex items-center gap-1 mb-1">
              <Calendar size={10} />
              Arrival
            </Label>
            {editingArrival ? (
              <Input
                type="datetime-local"
                defaultValue={toLocalDatetime(scheduledStart)}
                autoFocus
                className="h-8 text-sm w-[200px]"
                onBlur={(e) => {
                  setEditingArrival(false)
                  if (e.target.value) {
                    onDateChange("scheduled_start", new Date(e.target.value).toISOString())
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur()
                  } else if (e.key === "Escape") {
                    setEditingArrival(false)
                  }
                }}
              />
            ) : (
              <button
                onClick={() => setEditingArrival(true)}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer text-left"
              >
                {formatDisplay(scheduledStart)}
              </button>
            )}
          </div>

          <div className="text-muted-foreground/30 self-end mb-1">–</div>

          {/* Expected Completion */}
          <div className="flex-1 lg:flex-initial">
            <Label className="text-[10px] uppercase text-muted-foreground tracking-wide flex items-center gap-1 mb-1">
              <Clock size={10} />
              Expected Completion
            </Label>
            {editingCompletion ? (
              <Input
                type="datetime-local"
                defaultValue={toLocalDatetime(scheduledEnd)}
                autoFocus
                className="h-8 text-sm w-[200px]"
                onBlur={(e) => {
                  setEditingCompletion(false)
                  if (e.target.value) {
                    onDateChange("scheduled_end", new Date(e.target.value).toISOString())
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur()
                  } else if (e.key === "Escape") {
                    setEditingCompletion(false)
                  }
                }}
              />
            ) : (
              <button
                onClick={() => setEditingCompletion(true)}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer text-left"
              >
                {formatDisplay(scheduledEnd)}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

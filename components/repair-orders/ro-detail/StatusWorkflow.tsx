"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronRight, LucideIcon, Calendar, Clock } from "lucide-react"
import { format } from "date-fns"

export interface WorkflowStage {
  id: string
  label: string
  icon: LucideIcon
  active: boolean
  completed: boolean
}

interface StatusWorkflowProps {
  stages: WorkflowStage[]
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

export function StatusWorkflow({ stages, scheduledStart, scheduledEnd, onDateChange }: StatusWorkflowProps) {
  const [editingArrival, setEditingArrival] = useState(false)
  const [editingCompletion, setEditingCompletion] = useState(false)

  return (
    <Card className="p-4 border-border">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Status pipeline */}
        <div className="flex items-center justify-between overflow-x-auto">
          {stages.map((stage, idx) => {
            const Icon = stage.icon
            return (
              <div key={stage.id} className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${
                    stage.completed
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : stage.active
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon size={14} />
                  <span className="font-medium whitespace-nowrap">{stage.label}</span>
                </div>
                {idx < stages.length - 1 && <ChevronRight size={14} className="text-border flex-shrink-0" />}
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

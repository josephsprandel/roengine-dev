"use client"

import { format, setHours, setMinutes } from "date-fns"

export const SLOT_HEIGHT = 60 // px per 30 minutes
export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 18
export const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2 // 22 slots
export const GRID_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT // 1320px

/**
 * Calculate top offset in pixels for a given time within the day grid.
 */
export function timeToOffset(date: Date): number {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const totalMinutes = (hours - DAY_START_HOUR) * 60 + minutes
  return (totalMinutes / 30) * SLOT_HEIGHT
}

/**
 * Calculate height in pixels for a duration between two times.
 */
export function durationToHeight(start: Date, end: Date): number {
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
  return Math.max((durationMinutes / 30) * SLOT_HEIGHT, SLOT_HEIGHT) // minimum 1 slot
}

/**
 * Generate time slot labels for the left axis.
 */
export function generateTimeSlots(): { hour: number; minute: number; label: string; isHour: boolean }[] {
  const slots: { hour: number; minute: number; label: string; isHour: boolean }[] = []
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    const hourDate = setMinutes(setHours(new Date(), h), 0)
    slots.push({
      hour: h,
      minute: 0,
      label: format(hourDate, "h:mm a"),
      isHour: true,
    })
    slots.push({
      hour: h,
      minute: 30,
      label: format(setMinutes(hourDate, 30), "h:mm"),
      isHour: false,
    })
  }
  return slots
}

interface TimeLabelsProps {
  className?: string
}

/**
 * Renders the time label column on the left side of the grid.
 * Labels are absolutely positioned so they center on each hour grid line.
 */
export function TimeLabels({ className }: TimeLabelsProps) {
  const slots = generateTimeSlots()

  return (
    <div className={`relative ${className || ""}`} style={{ height: GRID_HEIGHT }}>
      {slots.map((slot) => {
        if (!slot.isHour) return null
        const slotIndex = (slot.hour - DAY_START_HOUR) * 2
        const top = slotIndex * SLOT_HEIGHT

        return (
          <div
            key={`${slot.hour}:${slot.minute}`}
            className="absolute right-0 pr-3 flex items-center"
            style={{ top: top - 8, height: 16 }}
          >
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {slot.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface TimeGridLinesProps {
  children: React.ReactNode
  className?: string
}

/**
 * Renders the horizontal grid lines for the time grid.
 */
export function TimeGridLines({ children, className }: TimeGridLinesProps) {
  const slots = generateTimeSlots()

  return (
    <div className={`relative ${className || ""}`} style={{ height: GRID_HEIGHT }}>
      {/* Grid lines */}
      {slots.map((slot) => (
        <div
          key={`line-${slot.hour}:${slot.minute}`}
          style={{ height: SLOT_HEIGHT }}
          className={`border-t ${
            slot.isHour
              ? "border-border"
              : "border-border/40 border-dashed"
          }`}
        />
      ))}
      {/* Content overlay */}
      <div className="absolute inset-0">{children}</div>
    </div>
  )
}

/**
 * Construct a timestamp for a given date + hour + minute.
 */
export function buildTimestamp(date: Date, hour: number, minute: number): string {
  const d = new Date(date)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/**
 * Parse a slot ID string like "bay:3:09:00" into components.
 */
export function parseSlotId(slotId: string): { type: string; parts: string[] } {
  const segments = slotId.split(":")
  return {
    type: segments[0],
    parts: segments.slice(1),
  }
}

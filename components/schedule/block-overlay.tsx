"use client"

import {
  timeToOffset,
  durationToHeight,
  DAY_START_HOUR,
  DAY_END_HOUR,
  GRID_HEIGHT,
  SLOT_HEIGHT,
} from "./time-grid"
import type { ScheduleBlock } from "./schedule-calendar"

interface BlockOverlayProps {
  block: ScheduleBlock
  currentDate: Date
  onClick: (block: ScheduleBlock) => void
}

export function BlockOverlay({ block, currentDate, onClick }: BlockOverlayProps) {
  const isFullDay = !block.start_time

  let top: number
  let height: number

  if (isFullDay) {
    top = 0
    height = GRID_HEIGHT
  } else {
    const [sh, sm] = block.start_time!.split(":").map(Number)
    const [eh, em] = block.end_time!.split(":").map(Number)
    const startDate = new Date(currentDate)
    startDate.setHours(sh, sm, 0, 0)
    const endDate = new Date(currentDate)
    endDate.setHours(eh, em, 0, 0)
    top = timeToOffset(startDate)
    height = durationToHeight(startDate, endDate)
  }

  return (
    <div
      className="absolute left-0 right-0 z-[5] cursor-pointer transition-opacity hover:opacity-80"
      style={{ top, height }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(block)
      }}
    >
      <div
        className="h-full w-full bg-muted/50 border border-dashed border-muted-foreground/30 rounded overflow-hidden"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 10px)",
        }}
      >
        <span className="px-2 py-1 text-xs text-muted-foreground truncate block">
          {block.reason || "Blocked"}
        </span>
      </div>
    </div>
  )
}

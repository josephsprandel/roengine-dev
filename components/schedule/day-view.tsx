"use client"

import { useDroppable } from "@dnd-kit/core"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ROCard, type ScheduledOrder } from "./ro-card"
import { BlockOverlay } from "./block-overlay"
import type { ScheduleBlock } from "./schedule-calendar"
import type { BlockDialogDefaults } from "./block-dialog"
import {
  TimeLabels,
  SLOT_HEIGHT,
  GRID_HEIGHT,
  timeToOffset,
  durationToHeight,
  generateTimeSlots,
  buildTimestamp,
} from "./time-grid"

interface DayViewProps {
  orders: ScheduledOrder[]
  blocks: ScheduleBlock[]
  currentDate: Date
  activeId: number | null
  onResize: (orderId: number, newEndISO: string) => void
  onBlockClick: (block: ScheduleBlock) => void
  onBlockTime: (defaults: BlockDialogDefaults) => void
}

function DroppableCell({
  id,
  onClick,
  onContextMenu,
  isHour,
}: {
  id: string
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  isHour: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ height: SLOT_HEIGHT }}
      className={`border-t cursor-pointer transition-colors ${
        isHour ? "border-border" : "border-border/40 border-dashed"
      } ${isOver ? "bg-primary/10" : "hover:bg-muted/50"}`}
    />
  )
}

/**
 * Compute overlap columns for orders.
 * Orders that overlap in time are placed in adjacent columns.
 */
function computeOverlapColumns(orders: ScheduledOrder[]): Map<number, { column: number; totalColumns: number }> {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
  )

  // Assign columns using a greedy algorithm
  const placements: { order: ScheduledOrder; column: number; start: number; end: number }[] = []

  for (const order of sorted) {
    const start = new Date(order.scheduled_start).getTime()
    const end = new Date(order.scheduled_end).getTime()

    // Find the first column where this order doesn't overlap
    let column = 0
    while (true) {
      const conflict = placements.find(
        (p) => p.column === column && p.start < end && p.end > start
      )
      if (!conflict) break
      column++
    }

    placements.push({ order, column, start, end })
  }

  // Compute total columns for each overlap group
  const result = new Map<number, { column: number; totalColumns: number }>()

  for (const placement of placements) {
    // Find all overlapping placements
    const overlapping = placements.filter(
      (p) => p.start < placement.end && p.end > placement.start
    )
    const maxCol = Math.max(...overlapping.map((p) => p.column)) + 1

    result.set(placement.order.id, {
      column: placement.column,
      totalColumns: maxCol,
    })
  }

  return result
}

export function DayView({ orders, blocks, currentDate, activeId, onResize, onBlockClick, onBlockTime }: DayViewProps) {
  const router = useRouter()
  const slots = generateTimeSlots()
  const overlapMap = computeOverlapColumns(orders)
  const dateStr = format(currentDate, "yyyy-MM-dd")

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <div className="flex min-w-[400px]">
          {/* Time labels column */}
          <div className="flex-shrink-0 w-20 border-r border-border">
            <TimeLabels />
          </div>

          {/* Day column */}
          <div className="flex-1 relative" style={{ height: GRID_HEIGHT }}>
            {/* Droppable cells */}
            {slots.map((slot) => (
              <DroppableCell
                key={`day:${slot.hour}:${String(slot.minute).padStart(2, "0")}`}
                id={`day:${slot.hour}:${String(slot.minute).padStart(2, "0")}`}
                isHour={slot.isHour}
                onClick={() => {
                  const scheduledStart = buildTimestamp(currentDate, slot.hour, slot.minute)
                  router.push(`/repair-orders/new?scheduledStart=${encodeURIComponent(scheduledStart)}`)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  const startTime = `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`
                  const endHour = slot.minute === 30 ? slot.hour + 1 : slot.hour
                  const endMinute = slot.minute === 30 ? 30 : 0
                  const endTime = `${String(endHour + (slot.minute === 0 ? 1 : 0)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`
                  onBlockTime({
                    date: dateStr,
                    startTime,
                    endTime,
                  })
                }}
              />
            ))}

            {/* Block overlays */}
            {blocks.map((block) => (
              <BlockOverlay
                key={`block-${block.id}`}
                block={block}
                currentDate={currentDate}
                onClick={onBlockClick}
              />
            ))}

            {/* Positioned RO cards with overlap handling */}
            {orders.map((order) => {
              const start = new Date(order.scheduled_start)
              const end = new Date(order.scheduled_end)
              const top = timeToOffset(start)
              const height = durationToHeight(start, end)
              const overlap = overlapMap.get(order.id) || { column: 0, totalColumns: 1 }
              const widthPercent = 100 / overlap.totalColumns
              const leftPercent = overlap.column * widthPercent

              return (
                <div
                  key={order.id}
                  className="absolute z-10"
                  style={{
                    top,
                    height,
                    left: `calc(${leftPercent}% + 2px)`,
                    width: `calc(${widthPercent}% - 4px)`,
                  }}
                >
                  <ROCard
                    order={order}
                    onResize={onResize}
                    isBeingDragged={activeId === order.id}
                    style={{ height: "100%" }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

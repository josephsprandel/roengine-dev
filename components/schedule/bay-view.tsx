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
  TimeGridLines,
  SLOT_HEIGHT,
  DAY_START_HOUR,
  DAY_END_HOUR,
  GRID_HEIGHT,
  timeToOffset,
  durationToHeight,
  generateTimeSlots,
  buildTimestamp,
} from "./time-grid"

const BAYS = ["1", "2", "3", "4", "5", "6"]
const ALL_COLUMNS = [...BAYS, "unassigned"]

interface BayViewProps {
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

function BayColumn({
  bay,
  orders,
  blocks,
  currentDate,
  activeId,
  onResize,
  onBlockClick,
  onBlockTime,
}: {
  bay: string
  orders: ScheduledOrder[]
  blocks: ScheduleBlock[]
  currentDate: Date
  activeId: number | null
  onResize: (orderId: number, newEndISO: string) => void
  onBlockClick: (block: ScheduleBlock) => void
  onBlockTime: (defaults: BlockDialogDefaults) => void
}) {
  const router = useRouter()
  const slots = generateTimeSlots()
  const isUnassigned = bay === "unassigned"
  const label = isUnassigned ? "Unassigned" : `Bay ${bay}`

  // Filter orders for this bay
  const bayOrders = orders.filter((o) => {
    if (isUnassigned) return !o.bay_assignment
    return o.bay_assignment === bay
  })

  // Filter blocks for this bay (all-bay blocks + bay-specific blocks)
  const bayBlocks = blocks.filter(
    (b) => b.bay_assignment === null || b.bay_assignment === bay
  )

  const dateStr = format(currentDate, "yyyy-MM-dd")

  return (
    <div className="flex-1 min-w-[140px]">
      {/* Column header */}
      <div className="h-10 flex items-center justify-center border-b border-border bg-muted/30 sticky top-0 z-10">
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>

      {/* Time grid with cards */}
      <div className="relative" style={{ height: GRID_HEIGHT }}>
        {/* Droppable cells */}
        {slots.map((slot) => (
          <DroppableCell
            key={`${bay}:${slot.hour}:${String(slot.minute).padStart(2, "0")}`}
            id={`bay:${bay}:${slot.hour}:${String(slot.minute).padStart(2, "0")}`}
            isHour={slot.isHour}
            onClick={() => {
              const scheduledStart = buildTimestamp(currentDate, slot.hour, slot.minute)
              const params = new URLSearchParams({ scheduledStart })
              if (!isUnassigned) params.set("bay", bay)
              router.push(`/repair-orders/new?${params}`)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              const startTime = `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`
              // Default to 1 hour block
              const endHour = slot.minute === 30 ? slot.hour + 1 : slot.hour
              const endMinute = slot.minute === 30 ? 30 : 0
              const endTime = `${String(endHour + (slot.minute === 0 ? 1 : 0)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`
              onBlockTime({
                date: dateStr,
                startTime,
                endTime,
                bay: isUnassigned ? undefined : bay,
              })
            }}
          />
        ))}

        {/* Block overlays */}
        {bayBlocks.map((block) => (
          <BlockOverlay
            key={`block-${block.id}-${bay}`}
            block={block}
            currentDate={currentDate}
            onClick={onBlockClick}
          />
        ))}

        {/* Positioned RO cards */}
        {bayOrders.map((order) => {
          const start = new Date(order.scheduled_start)
          const end = new Date(order.scheduled_end)
          const top = timeToOffset(start)
          const height = durationToHeight(start, end)

          return (
            <div
              key={order.id}
              className="absolute left-1 right-1 z-10"
              style={{ top, height }}
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
  )
}

export function BayView({ orders, blocks, currentDate, activeId, onResize, onBlockClick, onBlockTime }: BayViewProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <div className="flex min-w-[900px]">
          {/* Time labels column */}
          <div className="flex-shrink-0 w-20 border-r border-border">
            <div className="h-10 border-b border-border bg-muted/30" />
            <TimeLabels />
          </div>

          {/* Bay columns */}
          {ALL_COLUMNS.map((bay, idx) => (
            <div
              key={bay}
              className={`flex-1 min-w-[140px] ${
                idx < ALL_COLUMNS.length - 1 ? "border-r border-border" : ""
              }`}
            >
              <BayColumn
                bay={bay}
                orders={orders}
                blocks={blocks}
                currentDate={currentDate}
                activeId={activeId}
                onResize={onResize}
                onBlockClick={onBlockClick}
                onBlockTime={onBlockTime}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

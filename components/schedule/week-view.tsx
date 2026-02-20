"use client"

import { useDroppable } from "@dnd-kit/core"
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns"
import { ROCard, type ScheduledOrder } from "./ro-card"
import type { ScheduleBlock } from "./schedule-calendar"
import type { BlockDialogDefaults } from "./block-dialog"

interface WeekViewProps {
  orders: ScheduledOrder[]
  blocks: ScheduleBlock[]
  currentDate: Date
  activeId: number | null
  onBlockClick: (block: ScheduleBlock) => void
  onBlockTime: (defaults: BlockDialogDefaults) => void
}

function DayColumn({
  date,
  orders,
  blocks,
  activeId,
  onBlockClick,
  onBlockTime,
}: {
  date: Date
  orders: ScheduledOrder[]
  blocks: ScheduleBlock[]
  activeId: number | null
  onBlockClick: (block: ScheduleBlock) => void
  onBlockTime: (defaults: BlockDialogDefaults) => void
}) {
  const dateStr = format(date, "yyyy-MM-dd")
  const { setNodeRef, isOver } = useDroppable({ id: `week:${dateStr}` })
  const dayOrders = orders.filter((o) => isSameDay(new Date(o.scheduled_start), date))
  const dayBlocks = blocks.filter((b) => b.block_date === dateStr)
  const today = isToday(date)

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[130px] border-r last:border-r-0 border-border flex flex-col ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
      {/* Day header */}
      <div
        className={`h-14 flex flex-col items-center justify-center border-b border-border ${
          today ? "bg-primary/10" : "bg-muted/30"
        }`}
      >
        <span className="text-xs text-muted-foreground">{format(date, "EEE")}</span>
        <span
          className={`text-lg font-semibold leading-tight ${
            today ? "text-primary" : "text-foreground"
          }`}
        >
          {format(date, "d")}
        </span>
      </div>

      {/* Block banners */}
      {dayBlocks.length > 0 && (
        <div className="px-1 pt-1 space-y-0.5">
          {dayBlocks.map((block) => (
            <div
              key={`block-${block.id}`}
              className="bg-muted/60 border border-dashed border-muted-foreground/30 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground cursor-pointer truncate hover:opacity-80"
              onClick={() => onBlockClick(block)}
            >
              {block.start_time
                ? `Blocked ${block.start_time.substring(0, 5)}-${block.end_time!.substring(0, 5)}`
                : "Blocked All Day"}
              {block.bay_assignment ? ` (Bay ${block.bay_assignment})` : ""}
            </div>
          ))}
        </div>
      )}

      {/* Stacked cards */}
      <div
        className="flex-1 p-1 space-y-1 overflow-y-auto min-h-[200px]"
        onContextMenu={(e) => {
          e.preventDefault()
          onBlockTime({ date: dateStr })
        }}
      >
        {dayOrders.length === 0 && dayBlocks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-xs text-muted-foreground/50">No appointments</span>
          </div>
        ) : (
          dayOrders.map((order) => (
            <ROCard key={order.id} order={order} compact isBeingDragged={activeId === order.id} />
          ))
        )}
      </div>
    </div>
  )
}

export function WeekView({ orders, blocks, currentDate, activeId, onBlockClick, onBlockTime }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }) // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex min-w-[700px] min-h-[400px]">
        {days.map((date) => (
          <DayColumn
            key={date.toISOString()}
            date={date}
            orders={orders}
            blocks={blocks}
            activeId={activeId}
            onBlockClick={onBlockClick}
            onBlockTime={onBlockTime}
          />
        ))}
      </div>
    </div>
  )
}

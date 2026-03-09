"use client"

import { useDroppable } from "@dnd-kit/core"
import { useRouter } from "next/navigation"
import { format, startOfWeek, addDays, isSameDay, isToday } from "date-fns"
import { ArrowRight, Ban } from "lucide-react"
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
  onDaySelect: (date: Date) => void
}

function DayColumn({
  date,
  orders,
  blocks,
  activeId,
  onBlockClick,
  onBlockTime,
  onDaySelect,
}: {
  date: Date
  orders: ScheduledOrder[]
  blocks: ScheduleBlock[]
  activeId: number | null
  onBlockClick: (block: ScheduleBlock) => void
  onBlockTime: (defaults: BlockDialogDefaults) => void
  onDaySelect: (date: Date) => void
}) {
  const router = useRouter()
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
        className={`h-14 flex items-center justify-between px-2 border-b border-border ${
          today ? "bg-primary/10" : "bg-muted/30"
        }`}
      >
        <div className="flex flex-col items-center flex-1">
          <span className="text-xs text-muted-foreground">{format(date, "EEE")}</span>
          <span
            className={`text-lg font-semibold leading-tight ${
              today ? "text-primary" : "text-foreground"
            }`}
          >
            {format(date, "d")}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDaySelect(date) }}
          className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title={`View ${format(date, "EEEE")} in day view`}
        >
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Block banners */}
      {dayBlocks.length > 0 && (
        <div className="px-1 pt-1 space-y-1">
          {dayBlocks.map((block) => (
            <div
              key={`block-${block.id}`}
              className="border border-dashed border-amber-500/40 rounded-md cursor-pointer hover:opacity-80 overflow-hidden"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(245,158,11,0.08) 4px, rgba(245,158,11,0.08) 8px)",
                backgroundColor: "rgba(245,158,11,0.06)",
              }}
              onClick={() => onBlockClick(block)}
            >
              <div className="flex items-center gap-1 px-1.5 py-1">
                <Ban size={10} className="text-amber-500/70 flex-shrink-0" />
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium truncate leading-tight">
                  {block.start_time
                    ? `${block.start_time.substring(0, 5)}–${block.end_time!.substring(0, 5)}`
                    : "All Day"}
                </div>
              </div>
              {(block.reason || block.bay_assignment) && (
                <div className="px-1.5 pb-1 text-[9px] text-amber-600/70 dark:text-amber-500/60 truncate leading-tight">
                  {block.reason || ""}
                  {block.reason && block.bay_assignment ? " · " : ""}
                  {block.bay_assignment ? `Bay ${block.bay_assignment}` : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stacked cards */}
      <div
        className="flex-1 p-1 space-y-1 overflow-y-auto min-h-[200px]"
        onDoubleClick={() => {
          const scheduledStart = `${dateStr}T09:00:00`
          router.push(`/repair-orders/new?scheduledStart=${encodeURIComponent(scheduledStart)}`)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onBlockTime({ date: dateStr })
        }}
      >
        {dayOrders.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            {dayBlocks.length === 0 && (
              <span className="text-xs text-muted-foreground/50">No appointments</span>
            )}
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

export function WeekView({ orders, blocks, currentDate, activeId, onBlockClick, onBlockTime, onDaySelect }: WeekViewProps) {
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
            onDaySelect={onDaySelect}
          />
        ))}
      </div>
    </div>
  )
}

"use client"

import { useDroppable } from "@dnd-kit/core"
import { useRouter } from "next/navigation"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns"
import { ArrowRight, Ban } from "lucide-react"
import { ROCard, type ScheduledOrder } from "./ro-card"
import type { ScheduleBlock } from "./schedule-calendar"
import type { BlockDialogDefaults } from "./block-dialog"

interface MonthViewProps {
  orders: ScheduledOrder[]
  blocks: ScheduleBlock[]
  currentDate: Date
  activeId: number | null
  onBlockClick: (block: ScheduleBlock) => void
  onBlockTime: (defaults: BlockDialogDefaults) => void
  onDaySelect: (date: Date) => void
}

const MAX_VISIBLE = 3

function DayCell({
  date,
  currentMonth,
  orders,
  blocks,
  activeId,
  onBlockClick,
  onBlockTime,
  onDaySelect,
}: {
  date: Date
  currentMonth: Date
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
  const inMonth = isSameMonth(date, currentMonth)
  const today = isToday(date)
  const overflow = dayOrders.length > MAX_VISIBLE ? dayOrders.length - MAX_VISIBLE : 0

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[110px] border-b border-r border-border flex flex-col ${
        isOver ? "bg-primary/10" : ""
      } ${!inMonth ? "bg-muted/20" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault()
        onBlockTime({ date: dateStr })
      }}
    >
      {/* Day number */}
      <div className="flex items-center justify-between px-1.5 pt-1">
        <span
          className={`text-xs font-medium leading-none ${
            today
              ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
              : inMonth
                ? "text-foreground"
                : "text-muted-foreground/50"
          }`}
        >
          {format(date, "d")}
        </span>
        <div className="flex items-center gap-0.5">
          {dayOrders.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{dayOrders.length}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDaySelect(date) }}
            className="p-0 rounded hover:bg-muted/60 text-muted-foreground/30 hover:text-muted-foreground transition-colors leading-none"
            title={`View ${format(date, "MMM d")} in day view`}
          >
            <ArrowRight size={10} />
          </button>
        </div>
      </div>

      {/* Block banners */}
      {dayBlocks.length > 0 && (
        <div className="px-1 mt-0.5 space-y-0.5">
          {dayBlocks.map((block) => (
            <div
              key={`block-${block.id}`}
              className="border border-dashed border-amber-500/40 rounded cursor-pointer hover:opacity-80 overflow-hidden"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(245,158,11,0.08) 3px, rgba(245,158,11,0.08) 6px)",
                backgroundColor: "rgba(245,158,11,0.06)",
              }}
              onClick={() => onBlockClick(block)}
            >
              <div className="flex items-center gap-0.5 px-1 py-px">
                <Ban size={8} className="text-amber-500/70 flex-shrink-0" />
                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-medium truncate leading-tight">
                  {block.start_time
                    ? `${block.start_time.substring(0, 5)}–${block.end_time!.substring(0, 5)}`
                    : "Blocked"}
                  {block.bay_assignment ? ` B${block.bay_assignment}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RO cards */}
      <div
        className="flex-1 px-1 mt-0.5 space-y-0.5 overflow-hidden"
        onDoubleClick={() => {
          const scheduledStart = `${dateStr}T09:00:00`
          router.push(`/repair-orders/new?scheduledStart=${encodeURIComponent(scheduledStart)}`)
        }}
      >
        {dayOrders.slice(0, MAX_VISIBLE).map((order) => (
          <ROCard
            key={order.id}
            order={order}
            compact
            isBeingDragged={activeId === order.id}
          />
        ))}
        {overflow > 0 && (
          <div className="text-[10px] text-muted-foreground px-0.5 font-medium">
            +{overflow} more
          </div>
        )}
      </div>
    </div>
  )
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function MonthView({ orders, blocks, currentDate, activeId, onBlockClick, onBlockTime, onDaySelect }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-xs font-medium text-muted-foreground text-center py-2 border-r last:border-r-0 border-border"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((date) => (
          <DayCell
            key={date.toISOString()}
            date={date}
            currentMonth={currentDate}
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

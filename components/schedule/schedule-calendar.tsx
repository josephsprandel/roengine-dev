"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  format,
  isSameDay,
} from "date-fns"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Loader2, Ban } from "lucide-react"
import { BayView } from "./bay-view"
import { DayView } from "./day-view"
import { WeekView } from "./week-view"
import { MonthView } from "./month-view"
import { ROCard, type ScheduledOrder } from "./ro-card"
import { parseSlotId, buildTimestamp } from "./time-grid"
import { BlockDialog, type BlockDialogDefaults } from "./block-dialog"

export interface ScheduleBlock {
  id: number
  block_date: string
  start_time: string | null
  end_time: string | null
  bay_assignment: string | null
  reason: string | null
  created_by: number
  created_at: string
}

type ViewType = "bay" | "day" | "week" | "month"

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

export function ScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewType>("bay")
  const [orders, setOrders] = useState<ScheduledOrder[]>([])
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)

  // Block dialog state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockDialogDefaults, setBlockDialogDefaults] = useState<BlockDialogDefaults | null>(null)

  // Block detail state
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null)

  // Require 8px of movement before activating drag (so clicks still work)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const fetchSchedule = useCallback(async () => {
    setLoading(true)
    try {
      let start: Date
      let end: Date

      if (view === "month") {
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
      } else if (view === "week") {
        start = startOfWeek(currentDate, { weekStartsOn: 1 })
        end = endOfWeek(currentDate, { weekStartsOn: 1 })
      } else {
        start = startOfDay(currentDate)
        end = endOfDay(currentDate)
      }

      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      })

      const startDate = format(start, "yyyy-MM-dd")
      const endDate = format(end, "yyyy-MM-dd")
      const blockParams = new URLSearchParams({ start: startDate, end: endDate })

      const headers = authHeaders()
      const [scheduleRes, blocksRes] = await Promise.all([
        fetch(`/api/schedule?${params}`, { headers }),
        fetch(`/api/schedule/blocks?${blockParams}`, { headers }),
      ])

      if (!scheduleRes.ok) throw new Error("Failed to fetch schedule")
      const scheduleData = await scheduleRes.json()
      setOrders(scheduleData.scheduled_orders || [])

      if (blocksRes.ok) {
        const blocksData = await blocksRes.json()
        setBlocks(blocksData.blocks || [])
      }
    } catch (err) {
      console.error("Failed to fetch schedule:", err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [currentDate, view])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  // Block mutations
  const createBlock = useCallback(
    async (blockData: {
      block_date: string
      start_time: string | null
      end_time: string | null
      bay_assignment: string | null
      reason: string | null
    }) => {
      try {
        const res = await fetch("/api/schedule/blocks", {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(blockData),
        })
        if (res.ok) {
          fetchSchedule()
        } else {
          console.error("Failed to create block:", await res.text())
        }
      } catch (err) {
        console.error("Failed to create block:", err)
      }
    },
    [fetchSchedule]
  )

  const deleteBlock = useCallback(
    async (blockId: number) => {
      try {
        const res = await fetch(`/api/schedule/blocks/${blockId}`, {
          method: "DELETE",
          headers: authHeaders(),
        })
        if (res.ok) {
          setSelectedBlock(null)
          fetchSchedule()
        } else {
          console.error("Failed to delete block:", await res.text())
        }
      } catch (err) {
        console.error("Failed to delete block:", err)
      }
    },
    [fetchSchedule]
  )

  // Open block dialog with defaults
  const handleBlockTime = useCallback(
    (defaults: BlockDialogDefaults) => {
      setBlockDialogDefaults(defaults)
      setBlockDialogOpen(true)
    },
    []
  )

  // View/delete existing block
  const handleBlockClick = useCallback((block: ScheduleBlock) => {
    setSelectedBlock(block)
  }, [])

  // Persist scheduling changes via PATCH
  const patchOrder = useCallback(async (orderId: number, updates: Record<string, any>) => {
    try {
      const res = await fetch(`/api/work-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        console.error("Failed to update order:", await res.text())
        // Revert on failure
        fetchSchedule()
      }
    } catch (err) {
      console.error("Failed to update order:", err)
      fetchSchedule()
    }
  }, [fetchSchedule])

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as number)
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over) return

      const orderId = active.id as number
      const order = orders.find((o) => o.id === orderId)
      if (!order) return

      const { type, parts } = parseSlotId(over.id as string)
      const duration =
        new Date(order.scheduled_end).getTime() - new Date(order.scheduled_start).getTime()

      let updates: Record<string, any> = {}

      if (type === "bay") {
        // bay:{bayNum}:{hour}:{minute}
        const [bay, hourStr, minuteStr] = parts
        const newStart = buildTimestamp(currentDate, parseInt(hourStr), parseInt(minuteStr))
        const newEnd = new Date(new Date(newStart).getTime() + duration).toISOString()
        updates = {
          scheduled_start: newStart,
          scheduled_end: newEnd,
          bay_assignment: bay === "unassigned" ? null : bay,
        }
      } else if (type === "day") {
        // day:{hour}:{minute}
        const [hourStr, minuteStr] = parts
        const newStart = buildTimestamp(currentDate, parseInt(hourStr), parseInt(minuteStr))
        const newEnd = new Date(new Date(newStart).getTime() + duration).toISOString()
        updates = {
          scheduled_start: newStart,
          scheduled_end: newEnd,
        }
      } else if (type === "week") {
        // week:{YYYY-MM-DD}
        const [dateStr] = parts
        const targetDate = new Date(dateStr + "T00:00:00")
        const originalStart = new Date(order.scheduled_start)
        // Preserve time-of-day, change date
        targetDate.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
        const newStart = targetDate.toISOString()
        const newEnd = new Date(targetDate.getTime() + duration).toISOString()
        updates = {
          scheduled_start: newStart,
          scheduled_end: newEnd,
        }
      }

      if (Object.keys(updates).length === 0) return

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
      )

      await patchOrder(orderId, updates)
    },
    [orders, currentDate, patchOrder]
  )

  // Resize handler
  const handleResize = useCallback(
    async (orderId: number, newEndISO: string) => {
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, scheduled_end: newEndISO } : o
        )
      )
      await patchOrder(orderId, { scheduled_end: newEndISO })
    },
    [patchOrder]
  )

  // Navigation
  const goToday = useCallback(() => setCurrentDate(new Date()), [])

  const goPrev = useCallback(() => {
    setCurrentDate((d) =>
      view === "month" ? subMonths(d, 1) : view === "week" ? subWeeks(d, 1) : subDays(d, 1)
    )
  }, [view])

  const goNext = useCallback(() => {
    setCurrentDate((d) =>
      view === "month" ? addMonths(d, 1) : view === "week" ? addWeeks(d, 1) : addDays(d, 1)
    )
  }, [view])

  // Date display
  const dateDisplay =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : view === "week"
        ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`
        : format(currentDate, "EEEE, MMMM d, yyyy")

  const isCurrentDay = isSameDay(currentDate, new Date())
  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null

  // Full-day all-bay blocks for banner display
  const fullDayBannerBlocks = blocks.filter(
    (b) =>
      !b.start_time &&
      !b.bay_assignment &&
      (view === "week" || view === "month" || b.block_date === format(currentDate, "yyyy-MM-dd"))
  )

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground">{dateDisplay}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList>
              <TabsTrigger value="bay">Bays</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              disabled={isCurrentDay && view !== "week" && view !== "month"}
            >
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext}>
              <ChevronRight size={16} />
            </Button>
          </div>

          {/* Block Time button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleBlockTime({ date: format(currentDate, "yyyy-MM-dd") })
            }
          >
            <Ban size={16} className="mr-1.5" />
            Block Time
          </Button>
        </div>
      </div>

      {/* Full-day block banners */}
      {view !== "week" && view !== "month" && fullDayBannerBlocks.length > 0 && (
        <div className="space-y-1">
          {fullDayBannerBlocks.map((block) => (
            <div
              key={`banner-${block.id}`}
              className="bg-muted border border-dashed border-muted-foreground/30 rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center justify-between cursor-pointer"
              onClick={() => handleBlockClick(block)}
            >
              <span>
                Day Blocked{block.reason ? `: ${block.reason}` : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteBlock(block.id)
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Calendar area */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin mr-2" size={24} />
            <span className="text-muted-foreground">Loading schedule...</span>
          </div>
        ) : (
          <>
            {view === "bay" && (
              <BayView
                orders={orders}
                blocks={blocks}
                currentDate={currentDate}
                activeId={activeId}
                onResize={handleResize}
                onBlockClick={handleBlockClick}
                onBlockTime={handleBlockTime}
              />
            )}
            {view === "day" && (
              <DayView
                orders={orders}
                blocks={blocks}
                currentDate={currentDate}
                activeId={activeId}
                onResize={handleResize}
                onBlockClick={handleBlockClick}
                onBlockTime={handleBlockTime}
              />
            )}
            {view === "week" && (
              <WeekView
                orders={orders}
                blocks={blocks}
                currentDate={currentDate}
                activeId={activeId}
                onBlockClick={handleBlockClick}
                onBlockTime={handleBlockTime}
              />
            )}
            {view === "month" && (
              <MonthView
                orders={orders}
                blocks={blocks}
                currentDate={currentDate}
                activeId={activeId}
                onBlockClick={handleBlockClick}
                onBlockTime={handleBlockTime}
              />
            )}
          </>
        )}

        {/* Ghost card that follows cursor during drag */}
        <DragOverlay>
          {activeOrder ? <ROCard order={activeOrder} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Empty state */}
      {!loading && orders.length === 0 && blocks.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-lg">No scheduled appointments</p>
          <p className="text-sm mt-1">
            Click any time slot to create a new repair order
          </p>
        </div>
      )}

      {/* Block creation dialog */}
      <BlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        defaults={blockDialogDefaults}
        onCreate={createBlock}
      />

      {/* Block detail dialog */}
      <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule Block</DialogTitle>
          </DialogHeader>
          {selectedBlock && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Date:</span>{" "}
                {selectedBlock.block_date}
              </p>
              <p>
                <span className="font-medium">Time:</span>{" "}
                {selectedBlock.start_time
                  ? `${selectedBlock.start_time.substring(0, 5)} - ${selectedBlock.end_time!.substring(0, 5)}`
                  : "All Day"}
              </p>
              <p>
                <span className="font-medium">Bay:</span>{" "}
                {selectedBlock.bay_assignment
                  ? `Bay ${selectedBlock.bay_assignment}`
                  : "All Bays"}
              </p>
              {selectedBlock.reason && (
                <p>
                  <span className="font-medium">Reason:</span>{" "}
                  {selectedBlock.reason}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => selectedBlock && deleteBlock(selectedBlock.id)}
            >
              Delete Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

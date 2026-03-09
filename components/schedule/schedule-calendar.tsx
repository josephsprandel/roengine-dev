"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { ChevronLeft, ChevronRight, Loader2, Ban, CalendarPlus } from "lucide-react"
import { toast } from "sonner"
import { BayView } from "./bay-view"
import { DayView } from "./day-view"
import { WeekView } from "./week-view"
import { MonthView } from "./month-view"
import { ROCard, type ScheduledOrder } from "./ro-card"
import { parseSlotId, buildTimestamp } from "./time-grid"
import { BlockDialog, type BlockDialogDefaults } from "./block-dialog"
import { SchedulingGateDialog } from "./scheduling-gate-dialog"
import type { SchedulingEvaluation } from "@/lib/scheduling/types"
import { useEdgeNavigation } from "./use-edge-navigation"

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
  const [draggedOrder, setDraggedOrder] = useState<ScheduledOrder | null>(null)
  const isDraggingRef = useRef(false)
  const calendarContainerRef = useRef<HTMLDivElement>(null)

  // Keep ref in sync with activeId (ref avoids adding to fetchSchedule deps)
  useEffect(() => {
    isDraggingRef.current = activeId !== null
  }, [activeId])

  // Block dialog state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockDialogDefaults, setBlockDialogDefaults] = useState<BlockDialogDefaults | null>(null)

  // Block detail state
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null)

  // Scheduling gate dialog state
  const [gateDialogOpen, setGateDialogOpen] = useState(false)
  const [gateEvaluation, setGateEvaluation] = useState<SchedulingEvaluation | null>(null)
  const [pendingDragUpdate, setPendingDragUpdate] = useState<{ orderId: number; updates: Record<string, any>; order: ScheduledOrder } | null>(null)

  // Require 8px of movement before activating drag (so clicks still work)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const fetchSchedule = useCallback(async () => {
    // During drag, skip the loading spinner so droppable zones stay visible
    if (!isDraggingRef.current) setLoading(true)
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
      if (!isDraggingRef.current) setLoading(false)
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
          toast.success('Block created')
          fetchSchedule()
        } else {
          console.error("Failed to create block:", await res.text())
          toast.error('Failed to update schedule')
        }
      } catch (err) {
        console.error("Failed to create block:", err)
        toast.error('Failed to update schedule')
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
          toast.success('Block removed')
          setSelectedBlock(null)
          fetchSchedule()
        } else {
          console.error("Failed to delete block:", await res.text())
          toast.error('Failed to update schedule')
        }
      } catch (err) {
        console.error("Failed to delete block:", err)
        toast.error('Failed to update schedule')
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

  // Send calendar invite for an appointment
  const sendInvite = useCallback(async (orderId: number) => {
    try {
      const res = await fetch(`/api/appointments/${orderId}/notify`, {
        method: "POST",
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        const parts: string[] = []
        if (data.sms_sent) parts.push("SMS")
        if (data.email_sent) parts.push("email")
        if (parts.length > 0) {
          toast.success(`Invite sent via ${parts.join(" and ")}`)
        } else {
          toast.warning("No invite sent", {
            description: data.errors?.join(". ") || "Customer has no contact info",
          })
        }
      } else {
        toast.error("Failed to send invite")
      }
    } catch {
      toast.error("Failed to send invite")
    }
  }, [])

  // Persist scheduling changes via PATCH
  const patchOrder = useCallback(async (orderId: number, updates: Record<string, any>, showInvite = false) => {
    try {
      const res = await fetch(`/api/work-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        if (showInvite) {
          toast.success('Schedule updated — Send calendar invite?', {
            action: {
              label: 'Send Invite',
              onClick: () => sendInvite(orderId),
            },
            duration: 8000,
          })
        } else {
          toast.success('Schedule updated')
        }
      } else {
        console.error("Failed to update order:", await res.text())
        toast.error('Failed to update schedule')
        // Revert on failure
        fetchSchedule()
      }
    } catch (err) {
      console.error("Failed to update order:", err)
      toast.error('Failed to update schedule')
      fetchSchedule()
    }
  }, [fetchSchedule, sendInvite])

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as number
    const order = orders.find((o) => o.id === id) || null
    setActiveId(id)
    setDraggedOrder(order)
  }, [orders])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setDraggedOrder(null)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null)
      const savedDraggedOrder = draggedOrder
      setDraggedOrder(null)
      const { active, over } = event
      if (!over) return

      const orderId = active.id as number
      // Prefer draggedOrder (survives cross-week navigation) over orders lookup
      const order = savedDraggedOrder ?? orders.find((o) => o.id === orderId)
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

      // Evaluate scheduling rules if the order has estimated_tech_hours
      if (order.estimated_tech_hours && updates.scheduled_start) {
        try {
          const evalRes = await fetch("/api/scheduling/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({
              proposed_date: updates.scheduled_start.slice(0, 10),
              estimated_tech_hours: order.estimated_tech_hours,
              is_waiter: order.is_waiter || false,
              vehicle_make: order.make || "",
              vehicle_model: order.model || "",
              work_order_id: orderId,
            }),
          })
          if (evalRes.ok) {
            const evaluation: SchedulingEvaluation = await evalRes.json()
            if (!evaluation.allowed || evaluation.soft_warnings.length > 0) {
              // Show gate dialog — pause the drag until SA responds
              setGateEvaluation(evaluation)
              setPendingDragUpdate({ orderId, updates, order })
              setGateDialogOpen(true)
              return
            }
          }
        } catch {
          // If evaluation fails, proceed anyway (don't block scheduling)
        }
      }

      // Optimistic update — if order exists in current view data, update it;
      // otherwise inject it (cross-week/month drop via edge navigation)
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === orderId)
        if (exists) {
          return prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
        }
        // Inject the dragged order with updated timestamps so it appears immediately
        return [...prev, { ...order, ...updates }]
      })

      await patchOrder(orderId, updates, !!updates.scheduled_start)
    },
    [orders, draggedOrder, currentDate, patchOrder]
  )

  // Gate dialog handlers
  const handleGateOverride = useCallback(async (reason: string) => {
    if (!pendingDragUpdate) return
    const { orderId, updates, order } = pendingDragUpdate
    setGateDialogOpen(false)
    setGateEvaluation(null)

    // Optimistic update — inject if cross-week drop
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === orderId)
      if (exists) {
        return prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
      }
      return [...prev, { ...order, ...updates }]
    })
    await patchOrder(orderId, {
      ...updates,
      rule_overrides: JSON.stringify({
        overridden_at: new Date().toISOString(),
        reason,
        source: "drag_reschedule",
      }),
    }, !!updates.scheduled_start)
    setPendingDragUpdate(null)
  }, [pendingDragUpdate, patchOrder])

  const handleGateCancel = useCallback(() => {
    setGateDialogOpen(false)
    setGateEvaluation(null)
    setPendingDragUpdate(null)
  }, [])

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

  // Navigate to a specific day in day view (from week/month arrow icon)
  const handleDaySelect = useCallback((date: Date) => {
    setCurrentDate(date)
    setView("day")
  }, [])

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
  // Prefer draggedOrder (survives navigation) over orders lookup
  const activeOrder = draggedOrder ?? (activeId ? orders.find((o) => o.id === activeId) : null)

  // Edge navigation — drag to left/right edge to navigate weeks/months
  const edgeState = useEdgeNavigation({
    containerRef: calendarContainerRef,
    isDragging: activeId !== null && (view === "week" || view === "month"),
    onNavigatePrev: goPrev,
    onNavigateNext: goNext,
  })

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
          <div ref={calendarContainerRef} className="relative">
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
                onDaySelect={handleDaySelect}
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
                onDaySelect={handleDaySelect}
              />
            )}

            {/* Edge navigation indicators — visible during drag in week/month views */}
            {activeId && (view === "week" || view === "month") && (
              <>
                <EdgeZoneIndicator
                  side="left"
                  active={edgeState.activeEdge === "left"}
                  progress={edgeState.progress}
                />
                <EdgeZoneIndicator
                  side="right"
                  active={edgeState.activeEdge === "right"}
                  progress={edgeState.progress}
                />
              </>
            )}
          </div>
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

      {/* Scheduling gate dialog (rules enforcement) */}
      <SchedulingGateDialog
        open={gateDialogOpen}
        onOpenChange={setGateDialogOpen}
        evaluation={gateEvaluation}
        onOverride={handleGateOverride}
        onCancel={handleGateCancel}
      />

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

/** Visual indicator shown at left/right edge during drag in week/month views */
function EdgeZoneIndicator({
  side,
  active,
  progress,
}: {
  side: "left" | "right"
  active: boolean
  progress: number
}) {
  return (
    <div
      className={`
        absolute top-0 bottom-0 w-[60px] z-30
        pointer-events-none transition-opacity duration-200
        ${side === "left" ? "left-0 rounded-l-lg" : "right-0 rounded-r-lg"}
        ${active ? "opacity-100" : "opacity-0"}
      `}
    >
      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 ${
          side === "left"
            ? "bg-gradient-to-r from-primary/20 to-transparent"
            : "bg-gradient-to-l from-primary/20 to-transparent"
        }`}
      />
      {/* Progress bar along the outer edge */}
      <div
        className={`absolute top-0 w-1 bg-primary/60 rounded-full transition-[height] duration-75 ${
          side === "left" ? "left-0" : "right-0"
        }`}
        style={{ height: `${progress * 100}%` }}
      />
      {/* Chevron icon */}
      <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-center">
        {side === "left" ? (
          <ChevronLeft size={24} className="text-primary animate-pulse" />
        ) : (
          <ChevronRight size={24} className="text-primary animate-pulse" />
        )}
      </div>
    </div>
  )
}

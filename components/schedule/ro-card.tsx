"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useRouter } from "next/navigation"
import { useRef, useCallback } from "react"

export interface ScheduledOrder {
  id: number
  ro_number: string
  state: string
  scheduled_start: string
  scheduled_end: string
  bay_assignment: string | null
  assigned_tech_id: number | null
  customer_name: string
  year: number
  make: string
  model: string
  tech_name: string | null
  services_summary: string | null
  service_count: number
  total: string
  booking_source?: string | null
  appointment_type?: string | null
  job_state_id?: number | null
  job_state_name?: string | null
  job_state_color?: string | null
  job_state_icon?: string | null
}

// Calendar-specific status colors
const STATUS_COLORS: Record<string, string> = {
  estimate: "bg-gray-200/80 border-gray-300 text-gray-700 dark:bg-gray-700/40 dark:border-gray-600 dark:text-gray-300",
  draft: "bg-gray-200/80 border-gray-300 text-gray-700 dark:bg-gray-700/40 dark:border-gray-600 dark:text-gray-300",
  open: "bg-blue-100/80 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300",
  approved: "bg-purple-100/80 border-purple-300 text-purple-800 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-300",
  in_progress: "bg-blue-100/80 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300",
  waiting_on_parts: "bg-amber-100/80 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300",
  waiting_approval: "bg-amber-100/80 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300",
  completed: "bg-green-100/80 border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-300",
  cancelled: "bg-gray-200/80 border-gray-300 text-gray-500 dark:bg-gray-700/40 dark:border-gray-600 dark:text-gray-500",
}

const STATUS_DOTS: Record<string, string> = {
  estimate: "bg-gray-400",
  draft: "bg-gray-400",
  open: "bg-blue-500",
  approved: "bg-purple-500",
  in_progress: "bg-blue-500",
  waiting_on_parts: "bg-amber-500",
  waiting_approval: "bg-amber-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-400",
}

interface ROCardProps {
  order: ScheduledOrder
  isDragOverlay?: boolean
  compact?: boolean
  onResize?: (orderId: number, newEndISO: string) => void
  style?: React.CSSProperties
  isBeingDragged?: boolean
}

export function ROCard({ order, isDragOverlay, compact, onResize, style: externalStyle, isBeingDragged }: ROCardProps) {
  const router = useRouter()
  const isDragging = useRef(false)

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: order.id,
  })

  const dragStyle = transform
    ? { transform: CSS.Transform.toString(transform) }
    : undefined

  const combinedStyle = {
    ...externalStyle,
    ...dragStyle,
    // Hide the original card while dragging (the DragOverlay shows the ghost)
    ...(isBeingDragged ? { opacity: 0.3 } : {}),
  }

  // Use dynamic job state color if available, otherwise fall back to hardcoded
  const hasDynamicColor = !!order.job_state_color
  const colorClass = hasDynamicColor ? "" : (STATUS_COLORS[order.state] || STATUS_COLORS.estimate)
  const dotColor = hasDynamicColor ? "" : (STATUS_DOTS[order.state] || STATUS_DOTS.estimate)
  const dynamicCardStyle = hasDynamicColor
    ? {
        backgroundColor: `${order.job_state_color}15`,
        borderColor: `${order.job_state_color}50`,
        color: order.job_state_color!,
      }
    : undefined
  const dynamicDotStyle = hasDynamicColor
    ? { backgroundColor: order.job_state_color! }
    : undefined

  // Extract last name
  const lastName = order.customer_name?.split(" ").pop() || order.customer_name || "Unknown"

  // Abbreviated vehicle
  const vehicle = `${order.year || ""} ${order.make || ""} ${(order.model || "").substring(0, 10)}`.trim()

  // Service display
  const serviceText =
    order.service_count <= 1
      ? order.services_summary || "No services"
      : `${order.service_count} services`

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't navigate if this was a drag or if this is an overlay
      if (isDragging.current || isDragOverlay) return
      e.stopPropagation()
      router.push(`/repair-orders/${order.id}`)
    },
    [isDragOverlay, order.id, router]
  )

  // Merge custom pointer tracking with dnd-kit listeners
  const mergedListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      isDragging.current = false
      // Call dnd-kit's handler
      listeners?.onPointerDown?.(e)
    },
    onPointerMove: (e: React.PointerEvent) => {
      isDragging.current = true
    },
  }

  // Resize handle for bottom edge (bay/day view only)
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!onResize) return
      e.stopPropagation()
      e.preventDefault()

      const startY = e.clientY
      const startEnd = new Date(order.scheduled_end)
      const startStart = new Date(order.scheduled_start)
      const minDuration = 30 * 60 * 1000 // 30 min minimum

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault()
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        const deltaY = upEvent.clientY - startY
        // 60px per 30 minutes
        const deltaMinutes = Math.round(deltaY / 60) * 30
        const newEnd = new Date(startEnd.getTime() + deltaMinutes * 60 * 1000)

        // Enforce minimum duration
        if (newEnd.getTime() - startStart.getTime() >= minDuration) {
          onResize(order.id, newEnd.toISOString())
        }

        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [onResize, order.id, order.scheduled_end, order.scheduled_start]
  )

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...combinedStyle, ...dynamicCardStyle }}
        {...mergedListeners}
        {...attributes}
        onClick={handleClick}
        className={`
          rounded-md border px-2 py-1 cursor-grab active:cursor-grabbing
          transition-shadow hover:shadow-md text-xs
          ${colorClass}
          ${isDragOverlay ? "shadow-lg opacity-90 rotate-1" : ""}
        `}
      >
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} style={dynamicDotStyle} />
          {order.booking_source === "online" && (
            <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-indigo-500 text-white text-[7px] font-bold flex items-center justify-center" title="Online booking">&#9679;</span>
          )}
          {(order.appointment_type === "waiter" || order.appointment_type === "online_waiter") && (
            <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[7px] font-bold flex items-center justify-center" title="Waiter">W</span>
          )}
          {(order.appointment_type === "drop_off" || order.appointment_type === "online_dropoff") && (
            <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[7px] font-bold flex items-center justify-center" title="Drop-off">D</span>
          )}
          <span className="font-medium truncate">{lastName}</span>
          <span className="text-muted-foreground truncate ml-auto">{order.ro_number}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...combinedStyle, ...dynamicCardStyle }}
      {...mergedListeners}
      {...attributes}
      onClick={handleClick}
      className={`
        relative rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing
        transition-shadow hover:shadow-md text-sm overflow-hidden
        ${colorClass}
        ${isDragOverlay ? "shadow-lg opacity-90 rotate-1" : ""}
      `}
    >
      <div className="space-y-0.5 min-h-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {order.booking_source === "online" && (
              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500 text-white text-[8px] font-bold flex items-center justify-center" title="Online booking">&#9679;</span>
            )}
            {(order.appointment_type === "waiter" || order.appointment_type === "online_waiter") && (
              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-sky-500 text-white text-[8px] font-bold flex items-center justify-center" title="Waiter">W</span>
            )}
            {(order.appointment_type === "drop_off" || order.appointment_type === "online_dropoff") && (
              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center" title="Drop-off">D</span>
            )}
            <span className="font-semibold truncate">{lastName}</span>
          </div>
          {order.tech_name && (
            <span className="text-xs opacity-70 truncate flex-shrink-0">
              {order.tech_name.split(" ")[0]}
            </span>
          )}
        </div>
        <p className="text-xs opacity-70 truncate">{vehicle}</p>
        <p className="text-xs truncate">{serviceText}</p>
      </div>
      {/* Resize handle */}
      {!isDragOverlay && onResize && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10 dark:hover:bg-white/10 rounded-b-md"
          onMouseDown={handleResizeStart}
        />
      )}
    </div>
  )
}

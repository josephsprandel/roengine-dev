"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface UseEdgeNavigationOptions {
  /** Ref to the calendar container element */
  containerRef: React.RefObject<HTMLElement | null>
  /** Whether a drag is currently active (only true in week/month view) */
  isDragging: boolean
  /** Called when the left edge triggers */
  onNavigatePrev: () => void
  /** Called when the right edge triggers */
  onNavigateNext: () => void
  /** Width of the edge detection zone in pixels */
  edgeZoneWidth?: number
  /** Milliseconds pointer must dwell in edge zone before triggering */
  triggerDelay?: number
  /** Minimum milliseconds between consecutive navigations */
  cooldown?: number
}

interface EdgeNavigationState {
  /** Which edge the pointer is currently hovering */
  activeEdge: "left" | "right" | null
  /** 0-1 progress toward triggering navigation */
  progress: number
}

export function useEdgeNavigation({
  containerRef,
  isDragging,
  onNavigatePrev,
  onNavigateNext,
  edgeZoneWidth = 60,
  triggerDelay = 600,
  cooldown = 1000,
}: UseEdgeNavigationOptions): EdgeNavigationState {
  const [activeEdge, setActiveEdge] = useState<"left" | "right" | null>(null)
  const [progress, setProgress] = useState(0)

  // Mutable refs to avoid re-render dependencies
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inCooldownRef = useRef(false)
  const lastPointerXRef = useRef(0)
  const currentEdgeRef = useRef<"left" | "right" | null>(null)
  const progressStartRef = useRef(0)

  // Store latest callbacks in refs so the pointermove handler always uses current values
  const onPrevRef = useRef(onNavigatePrev)
  const onNextRef = useRef(onNavigateNext)
  onPrevRef.current = onNavigatePrev
  onNextRef.current = onNavigateNext

  const clearTimers = useCallback(() => {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const resetState = useCallback(() => {
    clearTimers()
    currentEdgeRef.current = null
    setActiveEdge(null)
    setProgress(0)
  }, [clearTimers])

  const startDwell = useCallback(
    (edge: "left" | "right") => {
      clearTimers()
      currentEdgeRef.current = edge
      setActiveEdge(edge)
      setProgress(0)

      // Start progress animation
      progressStartRef.current = Date.now()
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - progressStartRef.current
        const p = Math.min(elapsed / triggerDelay, 1)
        setProgress(p)
      }, 16) // ~60fps

      // Start dwell timer
      dwellTimerRef.current = setTimeout(() => {
        // Fire navigation
        if (edge === "left") {
          onPrevRef.current()
        } else {
          onNextRef.current()
        }

        // Reset visual state and start cooldown
        clearTimers()
        setProgress(0)
        setActiveEdge(null)
        currentEdgeRef.current = null
        inCooldownRef.current = true

        cooldownTimerRef.current = setTimeout(() => {
          inCooldownRef.current = false

          // If pointer is still in an edge zone, start a new dwell
          const container = containerRef.current
          if (!container) return
          const rect = container.getBoundingClientRect()
          const x = lastPointerXRef.current

          if (x <= rect.left + edgeZoneWidth && x >= rect.left) {
            startDwell("left")
          } else if (x >= rect.right - edgeZoneWidth && x <= rect.right) {
            startDwell("right")
          }
        }, cooldown)
      }, triggerDelay)
    },
    [clearTimers, containerRef, edgeZoneWidth, triggerDelay, cooldown]
  )

  useEffect(() => {
    if (!isDragging) {
      resetState()
      // Also clear cooldown
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current)
        cooldownTimerRef.current = null
      }
      inCooldownRef.current = false
      return
    }

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current
      if (!container) return

      lastPointerXRef.current = e.clientX
      const rect = container.getBoundingClientRect()

      const inLeftZone = e.clientX <= rect.left + edgeZoneWidth && e.clientX >= rect.left
      const inRightZone = e.clientX >= rect.right - edgeZoneWidth && e.clientX <= rect.right

      if (inCooldownRef.current) {
        // During cooldown, just track position — dwell will start when cooldown expires
        return
      }

      if (inLeftZone) {
        if (currentEdgeRef.current !== "left") {
          startDwell("left")
        }
      } else if (inRightZone) {
        if (currentEdgeRef.current !== "right") {
          startDwell("right")
        }
      } else {
        // Not in any edge zone — reset
        if (currentEdgeRef.current !== null) {
          resetState()
        }
      }
    }

    const handlePointerUp = () => {
      resetState()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        resetState()
      }
    }

    const handleBlur = () => {
      resetState()
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      resetState()
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current)
        cooldownTimerRef.current = null
      }
      inCooldownRef.current = false
    }
  }, [isDragging, containerRef, edgeZoneWidth, startDwell, resetState])

  return { activeEdge, progress }
}

"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react"
import { useAuth } from "@/contexts/auth-context"

export interface TransferNotification {
  id: number
  work_order_id: number
  from_user_id: number | null
  from_user_name: string | null
  to_user_id: number
  from_state_id: number | null
  from_state_name: string | null
  from_state_color: string | null
  to_state_id: number
  to_state_name: string
  to_state_color: string
  to_state_icon: string
  note: string | null
  transferred_at: string
  ro_number: string
  customer_name: string | null
  vehicle_year: number | null
  vehicle_make: string | null
  vehicle_model: string | null
}

interface TransferNotificationsContextType {
  /** All currently pending (unaccepted) transfers for the logged-in user */
  pendingTransfers: TransferNotification[]
  /** Transfers that have appeared since the session started — shown as popups */
  newTransfers: TransferNotification[]
  /** Accept a transfer by ID (calls the existing accept endpoint) */
  acceptTransfer: (transferId: number, workOrderId: number) => Promise<void>
  /** Dismiss a popup card without accepting (it'll come back on next poll if still unaccepted) */
  dismissPopup: (transferId: number) => void
  /** Total count of unaccepted transfers */
  pendingCount: number
}

const TransferNotificationsContext = createContext<
  TransferNotificationsContextType | undefined
>(undefined)

const POLL_INTERVAL_MS = 10_000 // 10 seconds

export function TransferNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  const [pendingTransfers, setPendingTransfers] = useState<TransferNotification[]>([])
  const [newTransfers, setNewTransfers] = useState<TransferNotification[]>([])

  // Track which IDs we've already alerted about (persists across polls)
  const seenIdsRef = useRef<Set<number>>(new Set())
  // Track which popups have been manually dismissed this session
  const dismissedIdsRef = useRef<Set<number>>(new Set())

  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

      const playTone = (freq: number, startTime: number, duration: number) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(freq, startTime)

        // Fade in and out for a soft chime feel
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.35, startTime + 0.05)
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration)

        oscillator.start(startTime)
        oscillator.stop(startTime + duration)
      }

      const now = ctx.currentTime
      playTone(880, now, 0.25)        // High tone: A5
      playTone(1100, now + 0.2, 0.35) // Higher tone: C#6

      // Clean up context after sounds finish
      setTimeout(() => ctx.close(), 1500)
    } catch {
      // Web Audio not available — silent fail
    }
  }, [])

  const fetchPending = useCallback(async () => {
    if (!user) return

    try {
      const res = await fetch(`/api/notifications/transfers?user_id=${user.id}`)
      if (!res.ok) return

      const data = await res.json()
      const transfers: TransferNotification[] = data.transfers || []

      setPendingTransfers(transfers)

      // Find genuinely NEW transfers we haven't seen before
      const brandNew = transfers.filter((t) => !seenIdsRef.current.has(t.id))

      if (brandNew.length > 0) {
        // Mark them as seen
        brandNew.forEach((t) => seenIdsRef.current.add(t.id))

        // Add to popup queue (skip any that were dismissed this session)
        const toShow = brandNew.filter((t) => !dismissedIdsRef.current.has(t.id))
        if (toShow.length > 0) {
          setNewTransfers((prev) => [...prev, ...toShow])
          playChime()
        }
      }

      // Also ensure seen set stays in sync with pending (remove accepted ones)
      const pendingIds = new Set(transfers.map((t) => t.id))
      // Remove from newTransfers any that were accepted (no longer in pending)
      setNewTransfers((prev) => prev.filter((t) => pendingIds.has(t.id)))
    } catch {
      // Network error — silent fail, try again next poll
    }
  }, [user, playChime])

  // Start polling when authenticated
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) {
      setPendingTransfers([])
      setNewTransfers([])
      return
    }

    // Fetch immediately on mount / login
    fetchPending()

    const interval = setInterval(fetchPending, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isLoading, isAuthenticated, user, fetchPending])

  const acceptTransfer = useCallback(
    async (transferId: number, workOrderId: number) => {
      try {
        const res = await fetch(`/api/work-orders/${workOrderId}/transfer/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transfer_id: transferId }),
        })

        if (!res.ok) {
          console.error("Failed to accept transfer:", await res.json())
          return
        }

        // Optimistically remove from both lists
        setPendingTransfers((prev) => prev.filter((t) => t.id !== transferId))
        setNewTransfers((prev) => prev.filter((t) => t.id !== transferId))
        dismissedIdsRef.current.add(transferId)
      } catch (err) {
        console.error("Error accepting transfer:", err)
      }
    },
    []
  )

  const dismissPopup = useCallback((transferId: number) => {
    dismissedIdsRef.current.add(transferId)
    setNewTransfers((prev) => prev.filter((t) => t.id !== transferId))
  }, [])

  return (
    <TransferNotificationsContext.Provider
      value={{
        pendingTransfers,
        newTransfers,
        acceptTransfer,
        dismissPopup,
        pendingCount: pendingTransfers.length,
      }}
    >
      {children}
    </TransferNotificationsContext.Provider>
  )
}

export function useTransferNotifications() {
  const ctx = useContext(TransferNotificationsContext)
  if (!ctx) {
    throw new Error(
      "useTransferNotifications must be used within TransferNotificationsProvider"
    )
  }
  return ctx
}

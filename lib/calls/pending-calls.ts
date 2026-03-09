/**
 * In-memory map of pending bridged calls.
 * Maps leg 1 call_control_id → call metadata.
 *
 * Calls are short-lived (minutes), so in-memory is fine.
 * Entries are cleaned up on hangup or after 10 minutes.
 */

export interface PendingCall {
  customerPhone: string
  workOrderId: number | null
  userId: number
  initiatedAt: number
  leg2CallControlId?: string
}

export const pendingCalls = new Map<string, PendingCall>()

// Clean up stale entries every 5 minutes
setInterval(() => {
  const staleThreshold = Date.now() - 10 * 60 * 1000
  for (const [id, call] of pendingCalls) {
    if (call.initiatedAt < staleThreshold) {
      pendingCalls.delete(id)
    }
  }
}, 5 * 60 * 1000)

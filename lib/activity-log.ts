/**
 * Activity Log Helper
 *
 * Logs meaningful actions to the work_order_activity table.
 * Designed to be fire-and-forget — logging failures never break the caller.
 */

import { query } from '@/lib/db'

interface LogActivityParams {
  workOrderId: number
  userId?: number | null
  actorType: 'staff' | 'customer' | 'system'
  action: string
  description: string
  metadata?: Record<string, any>
}

/**
 * Log an activity entry for a work order.
 * Wrapped in try/catch so callers are never affected by logging failures.
 */
export async function logActivity({
  workOrderId,
  userId,
  actorType,
  action,
  description,
  metadata
}: LogActivityParams): Promise<void> {
  try {
    await query(
      `INSERT INTO work_order_activity (work_order_id, user_id, actor_type, action, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        workOrderId,
        userId ?? null,
        actorType,
        action,
        description,
        metadata ? JSON.stringify(metadata) : null
      ]
    )
  } catch (error) {
    console.error('[ActivityLog] Failed to log activity:', error)
  }
}

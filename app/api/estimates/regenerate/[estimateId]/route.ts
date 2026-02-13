/**
 * POST /api/estimates/regenerate/[estimateId]
 *
 * Create a new estimate superseding the previous one.
 * Auth: Required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { generateEstimate } from '@/lib/estimates'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { estimateId } = await params
    const id = parseInt(estimateId)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid estimate ID' }, { status: 400 })
    }

    const body = await request.json()
    const { recommendationIds, expiresInHours } = body

    if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one recommendation ID is required' },
        { status: 400 }
      )
    }

    // Fetch existing estimate
    const existingResult = await query(
      'SELECT id, work_order_id, status FROM estimates WHERE id = $1',
      [id]
    )

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const existing = existingResult.rows[0]

    // Mark old estimate as superseded
    await query(
      'UPDATE estimates SET status = $1, updated_at = NOW() WHERE id = $2',
      ['superseded', id]
    )

    // Mark old estimate services as superseded
    await query(
      'UPDATE estimate_services SET status = $1 WHERE estimate_id = $2',
      ['superseded', id]
    )

    // Generate new estimate
    const result = await generateEstimate({
      workOrderId: existing.work_order_id,
      recommendationIds,
      createdByUserId: user.id,
      expiresInHours: expiresInHours || 72
    })

    return NextResponse.json({
      ...result,
      previousEstimateId: id
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to regenerate estimate' },
      { status: 500 }
    )
  }
}

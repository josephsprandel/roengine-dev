/**
 * POST /api/work-orders/[id]/estimate/link
 *
 * Generate estimate and return copyable link.
 * Auth: Required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { generateEstimate } from '@/lib/estimates'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const body = await request.json()
    const { recommendationIds, expiresInHours, estimateType } = body

    if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one recommendation ID is required' },
        { status: 400 }
      )
    }

    const result = await generateEstimate({
      workOrderId,
      recommendationIds,
      createdByUserId: user.id,
      expiresInHours: expiresInHours || 72,
      estimateType: estimateType || 'maintenance'
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate estimate link' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    )
  }
}

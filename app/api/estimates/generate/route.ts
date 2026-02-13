/**
 * POST /api/estimates/generate
 *
 * Generate a digital estimate from AI recommendations.
 * Auth: Required - advisor must be logged in.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { generateEstimate } from '@/lib/estimates'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { workOrderId, recommendationIds, expiresInHours } = body

    if (!workOrderId || !Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return NextResponse.json(
        { error: 'workOrderId and at least one recommendationId are required' },
        { status: 400 }
      )
    }

    const result = await generateEstimate({
      workOrderId,
      recommendationIds,
      createdByUserId: user.id,
      expiresInHours: expiresInHours || 72
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate estimate' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    )
  }
}

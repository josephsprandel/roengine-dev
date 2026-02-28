import { NextRequest, NextResponse } from 'next/server'
import { rewriteLaborDescription } from '@/lib/local-ai'

export async function POST(request: NextRequest) {
  const { serviceTitle, description } = await request.json()

  if (!description || typeof description !== 'string') {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const rewritten = await rewriteLaborDescription(serviceTitle || '', description)

  return NextResponse.json({
    description: rewritten,
    source: rewritten ? 'local' : null,
  })
}

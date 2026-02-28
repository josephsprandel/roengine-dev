import { NextRequest, NextResponse } from 'next/server'
import { normalizeServiceTitle } from '@/lib/local-ai'

export async function POST(request: NextRequest) {
  const { title } = await request.json()

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const normalized = await normalizeServiceTitle(title)

  return NextResponse.json({
    normalized,
    source: normalized ? 'local' : null,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { rewriteServiceDescription } from '@/lib/local-ai'

export async function POST(request: NextRequest) {
  const { title, laborLines, techNotes, status: serviceStatus } = await request.json()

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const description = await rewriteServiceDescription(
    title,
    laborLines || '',
    techNotes || '',
    serviceStatus || ''
  )

  return NextResponse.json({
    description,
    source: description ? 'local' : null,
  })
}

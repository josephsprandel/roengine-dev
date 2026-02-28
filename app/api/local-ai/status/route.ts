import { NextResponse } from 'next/server'
import { checkOllamaStatus } from '@/lib/local-ai'

export async function GET() {
  const status = await checkOllamaStatus()
  return NextResponse.json(status)
}

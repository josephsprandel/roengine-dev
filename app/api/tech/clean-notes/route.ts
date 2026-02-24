import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { GoogleGenerativeAI } from '@google/generative-ai'

// POST /api/tech/clean-notes - AI cleanup of tech notes via Gemini
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json()
    const { notes, vehicle, inspection_item } = body

    if (!notes?.trim()) {
      return NextResponse.json({ error: 'Notes are required' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `You are an automotive service advisor writing notes for a customer-facing digital vehicle inspection report.

Rewrite the following technician notes into clear, professional language that a vehicle owner would understand.
Keep it concise (1-3 sentences max). Do not add information that isn't implied by the original notes.
Do not use overly technical jargon. Be factual and helpful.

Vehicle: ${vehicle || 'Unknown'}
Inspection Item: ${inspection_item || 'General inspection'}
Technician Notes: "${notes}"

Rewritten notes (just the text, no quotes or labels):`

    const result = await model.generateContent(prompt)
    const cleaned = result.response.text()

    return NextResponse.json({ cleaned_notes: cleaned.trim() })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error cleaning notes:', error)
    return NextResponse.json({ error: 'Failed to clean notes' }, { status: 500 })
  }
}

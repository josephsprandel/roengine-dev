import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// POST /api/work-orders/[id]/transfer/accept - Accept a pending transfer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workOrderId } = await params
    const body = await request.json()
    const { transfer_id } = body

    if (!transfer_id) {
      return NextResponse.json({ error: "transfer_id is required" }, { status: 400 })
    }

    // Verify the transfer belongs to this work order and hasn't been accepted
    const existing = await query(
      "SELECT id, accepted_at FROM job_transfers WHERE id = $1 AND work_order_id = $2",
      [transfer_id, workOrderId]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 })
    }
    if (existing.rows[0].accepted_at) {
      return NextResponse.json({ error: "Transfer already accepted" }, { status: 409 })
    }

    const result = await query(
      "UPDATE job_transfers SET accepted_at = NOW() WHERE id = $1 RETURNING *",
      [transfer_id]
    )

    return NextResponse.json({ transfer: result.rows[0] })
  } catch (error) {
    console.error("Error accepting transfer:", error)
    return NextResponse.json({ error: "Failed to accept transfer" }, { status: 500 })
  }
}

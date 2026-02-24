import { NextRequest, NextResponse } from "next/server"
import { getClient } from "@/lib/db"
import { applyCannedJobToWorkOrder } from "@/lib/apply-canned-job"

// POST /api/work-orders/[id]/apply-canned-job - Apply a canned job template to a work order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()
  try {
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      client.release()
      return NextResponse.json({ error: "Invalid work order ID" }, { status: 400 })
    }

    const body = await request.json()
    const { canned_job_id } = body

    if (!canned_job_id) {
      client.release()
      return NextResponse.json({ error: "canned_job_id is required" }, { status: 400 })
    }

    // Verify work order exists
    const woCheck = await client.query("SELECT id FROM work_orders WHERE id = $1", [workOrderId])
    if (woCheck.rows.length === 0) {
      client.release()
      return NextResponse.json({ error: "Work order not found" }, { status: 404 })
    }

    await client.query("BEGIN")

    const result = await applyCannedJobToWorkOrder(client, workOrderId, canned_job_id)

    await client.query("COMMIT")

    return NextResponse.json(
      {
        service_id: result.service_id,
        service_title: result.service_title,
        message: `Applied canned job: ${result.service_title}`,
      },
      { status: 201 }
    )
  } catch (error: any) {
    await client.query("ROLLBACK")
    console.error("Error applying canned job:", error)
    return NextResponse.json(
      { error: error.message || "Failed to apply canned job" },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

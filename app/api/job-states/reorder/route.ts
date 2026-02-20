import { NextRequest, NextResponse } from "next/server"
import { getClient } from "@/lib/db"

// PUT /api/job-states/reorder - Bulk update sort_order
export async function PUT(request: NextRequest) {
  const client = await getClient()
  try {
    const body = await request.json()
    const { orderedIds } = body

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds array is required" }, { status: 400 })
    }

    await client.query("BEGIN")

    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        "UPDATE job_states SET sort_order = $1 WHERE id = $2",
        [i + 1, orderedIds[i]]
      )
    }

    await client.query("COMMIT")

    return NextResponse.json({ message: "Reorder successful" })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error reordering job states:", error)
    return NextResponse.json({ error: "Failed to reorder job states" }, { status: 500 })
  } finally {
    client.release()
  }
}

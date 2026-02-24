import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// POST /api/tech/inspection/[id]/finding - Save finding and optionally create recommendation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()
  try {
    const user = await requireUser(request)
    const { id } = await params
    const resultId = parseInt(id)

    if (isNaN(resultId)) {
      return NextResponse.json({ error: 'Invalid inspection result ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      status,
      tech_notes,
      ai_cleaned_notes,
      condition,
      measurement_value,
      measurement_unit,
      create_recommendation,
      service_title,
      reason,
      priority,
      category_id,
    } = body

    await client.query('BEGIN')

    // 1. Update the inspection result
    await client.query(`
      UPDATE ro_inspection_results
      SET status = $1, tech_notes = $2, ai_cleaned_notes = $3,
          condition = $4, measurement_value = $5, measurement_unit = $6,
          inspected_by = $7, inspected_at = NOW()
      WHERE id = $8
    `, [
      status || 'red',
      tech_notes || null,
      ai_cleaned_notes || null,
      condition || null,
      measurement_value || null,
      measurement_unit || null,
      user.id,
      resultId,
    ])

    let recommendation_id = null

    // 2. Optionally create a vehicle recommendation
    if (create_recommendation && service_title) {
      // Get vehicle_id from the work order chain
      const woResult = await client.query(`
        SELECT wo.vehicle_id
        FROM ro_inspection_results r
        JOIN work_orders wo ON r.work_order_id = wo.id
        WHERE r.id = $1
      `, [resultId])

      const vehicle_id = woResult.rows[0]?.vehicle_id

      if (vehicle_id) {
        // Get photo_path from the inspection result (first photo if any)
        const photoResult = await client.query(
          'SELECT photos FROM ro_inspection_results WHERE id = $1',
          [resultId]
        )
        const photos = photoResult.rows[0]?.photos || []
        const photo_path = photos.length > 0 ? photos[0] : null

        const recResult = await client.query(`
          INSERT INTO vehicle_recommendations (
            vehicle_id, service_title, reason, priority,
            status, source, category_id, tech_notes, photo_path,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'awaiting_approval', 'inspection', $5, $6, $7, NOW(), NOW())
          RETURNING id
        `, [
          vehicle_id,
          service_title,
          reason || `Identified during vehicle inspection: ${condition || 'needs attention'}`,
          priority || 'recommended',
          category_id || 2, // default: repair
          ai_cleaned_notes || tech_notes || null,
          photo_path,
        ])

        recommendation_id = recResult.rows[0].id

        // Link finding to recommendation
        await client.query(`
          UPDATE ro_inspection_results
          SET finding_recommendation_id = $1
          WHERE id = $2
        `, [recommendation_id, resultId])
      }
    }

    await client.query('COMMIT')

    return NextResponse.json({ success: true, recommendation_id })
  } catch (error: any) {
    await client.query('ROLLBACK')
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error saving finding:', error)
    return NextResponse.json({ error: 'Failed to save finding' }, { status: 500 })
  } finally {
    client.release()
  }
}

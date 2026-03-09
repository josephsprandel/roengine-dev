import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateICS } from '@/lib/calendar/generate-ics'
import { getShopInfo } from '@/lib/email-templates'

// GET /api/appointments/[id]/ics — public ICS download for customer
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await query(
      `SELECT wo.id, wo.ro_number, wo.scheduled_start, wo.scheduled_end,
              wo.label, wo.customer_concern,
              c.customer_name,
              v.year, v.make, v.model
       FROM work_orders wo
       LEFT JOIN customers c ON c.id = wo.customer_id
       LEFT JOIN vehicles v ON v.id = wo.vehicle_id
       WHERE wo.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const wo = result.rows[0]
    if (!wo.scheduled_start) {
      return NextResponse.json({ error: 'No scheduled date' }, { status: 400 })
    }

    const shop = await getShopInfo()
    const start = new Date(wo.scheduled_start)
    const end = wo.scheduled_end ? new Date(wo.scheduled_end) : new Date(start.getTime() + 60 * 60 * 1000)

    const vehicleYMM = [wo.year, wo.make, wo.model].filter(Boolean).join(' ')
    const services = wo.label || wo.customer_concern || 'Vehicle Service'
    const descriptionParts = [
      `Services: ${services}`,
      vehicleYMM ? `Vehicle: ${vehicleYMM}` : '',
      `Phone: ${shop.phone}`,
    ].filter(Boolean)

    const ics = generateICS({
      id: wo.id,
      start,
      end,
      summary: `Service Appointment — ${shop.name}`,
      description: descriptionParts.join('\n'),
      location: shop.address,
      uid: `appointment-${wo.id}@autohousenwa.com`,
      organizerEmail: 'assistant@autohousenwa.com',
      organizerName: shop.name,
    })

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="autohouse-appointment.ics"',
      },
    })
  } catch (error: any) {
    console.error('[ICS] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

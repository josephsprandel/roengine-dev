import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    // Test the database connection
    const result = await query('SELECT NOW() as current_time, version() as pg_version')
    
    // Get counts from key tables
    const customersCount = await query('SELECT COUNT(*) as count FROM customers')
    const vehiclesCount = await query('SELECT COUNT(*) as count FROM vehicles')
    const workOrdersCount = await query('SELECT COUNT(*) as count FROM work_orders')

    return NextResponse.json({
      status: 'connected',
      timestamp: result.rows[0].current_time,
      database: {
        version: result.rows[0].pg_version,
        tables: {
          customers: parseInt(customersCount.rows[0].count),
          vehicles: parseInt(vehiclesCount.rows[0].count),
          work_orders: parseInt(workOrdersCount.rows[0].count),
        },
      },
    })
  } catch (error: any) {
    console.error('Database connection error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

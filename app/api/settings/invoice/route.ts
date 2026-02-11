/**
 * Invoice Settings API
 * 
 * GET /api/settings/invoice - Get invoice settings
 * PATCH /api/settings/invoice - Update invoice settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const result = await query(`
      SELECT 
        invoice_number_prefix,
        include_date,
        date_format,
        sequential_padding,
        sales_tax_rate,
        parts_taxable,
        labor_taxable,
        shop_supplies_enabled,
        shop_supplies_calculation,
        shop_supplies_percentage,
        shop_supplies_percentage_of,
        shop_supplies_cap,
        shop_supplies_flat_fee,
        cc_surcharge_enabled,
        cc_surcharge_rate,
        payroll_frequency,
        payroll_start_day
      FROM shop_profile
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Shop profile not found' }, { status: 404 })
    }

    const settings = result.rows[0]

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error fetching invoice settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      invoice_number_prefix,
      include_date,
      date_format,
      sequential_padding,
      sales_tax_rate,
      parts_taxable,
      labor_taxable,
      shop_supplies_enabled,
      shop_supplies_calculation,
      shop_supplies_percentage,
      shop_supplies_percentage_of,
      shop_supplies_cap,
      shop_supplies_flat_fee,
      cc_surcharge_enabled,
      cc_surcharge_rate,
      payroll_frequency,
      payroll_start_day,
    } = body

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    const addUpdate = (field: string, value: any) => {
      if (value !== undefined && value !== null) {
        paramCount++
        updates.push(`${field} = $${paramCount}`)
        values.push(value)
      }
    }

    addUpdate('invoice_number_prefix', invoice_number_prefix)
    addUpdate('include_date', include_date)
    addUpdate('date_format', date_format)
    addUpdate('sequential_padding', sequential_padding)
    addUpdate('sales_tax_rate', sales_tax_rate)
    addUpdate('parts_taxable', parts_taxable)
    addUpdate('labor_taxable', labor_taxable)
    addUpdate('shop_supplies_enabled', shop_supplies_enabled)
    addUpdate('shop_supplies_calculation', shop_supplies_calculation)
    addUpdate('shop_supplies_percentage', shop_supplies_percentage)
    addUpdate('shop_supplies_percentage_of', shop_supplies_percentage_of)
    addUpdate('shop_supplies_cap', shop_supplies_cap)
    addUpdate('shop_supplies_flat_fee', shop_supplies_flat_fee)
    addUpdate('cc_surcharge_enabled', cc_surcharge_enabled)
    addUpdate('cc_surcharge_rate', cc_surcharge_rate)
    addUpdate('payroll_frequency', payroll_frequency)
    addUpdate('payroll_start_day', payroll_start_day)

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')

    const sql = `
      UPDATE shop_profile 
      SET ${updates.join(', ')}
      WHERE id = 1
      RETURNING *
    `

    const result = await query(sql, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Shop profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice settings updated successfully',
      settings: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error updating invoice settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

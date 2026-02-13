/**
 * Work Order Items API
 * 
 * Handles CRUD operations for work_order_items with Excel-style auto-save
 * No confirmation dialogs - changes save immediately
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops_dev@localhost:5432/shopops3',
})

/**
 * GET /api/work-orders/[id]/items
 * Fetch all items for a work order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    
    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'Invalid work order ID' },
        { status: 400 }
      )
    }
    
    const result = await pool.query(`
      SELECT 
        id,
        work_order_id,
        item_type,
        description,
        notes,
        part_number,
        part_brand,
        quantity,
        unit_price,
        line_total,
        cost_price,
        is_taxable,
        labor_hours,
        labor_rate,
        display_order,
        service_id,
        part_id,
        created_at,
        updated_at
      FROM work_order_items
      WHERE work_order_id = $1
      ORDER BY display_order, id
    `, [workOrderId])

    return NextResponse.json({
      items: result.rows
    })
  } catch (error: any) {
    console.error('Error fetching work order items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/work-orders/[id]/items
 * Create a new work order item (Excel-style instant save)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    
    console.log('=== POST /api/work-orders/[id]/items ===')
    console.log('Work Order ID:', workOrderId)
    
    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'Invalid work order ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    console.log('Request body:', body)
    
    const {
      item_type,
      description,
      notes,
      part_number,
      part_brand,
      quantity,
      unit_price,
      labor_hours,
      labor_rate,
      is_taxable,
      display_order,
      service_id
    } = body

    // Calculate line total
    const line_total = item_type === 'labor' 
      ? (labor_hours || 0) * (labor_rate || 160)
      : (quantity || 1) * (unit_price || 0)

    console.log('Inserting into database...')
    console.log('- item_type:', item_type || 'part')
    console.log('- description:', description || 'New Item')
    console.log('- line_total:', line_total)
    
    const result = await pool.query(`
      INSERT INTO work_order_items (
        work_order_id,
        item_type,
        description,
        notes,
        part_number,
        part_brand,
        quantity,
        unit_price,
        line_total,
        labor_hours,
        labor_rate,
        is_taxable,
        display_order,
        service_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *
    `, [
      workOrderId,
      item_type || 'part',
      description || 'New Item',
      notes || null,
      part_number || null,
      part_brand || null,
      quantity || 1,
      unit_price || 0,
      line_total,
      labor_hours || null,
      labor_rate || 160,
      is_taxable ?? true,
      display_order || 0,
      service_id || null
    ])

    console.log('✓ Inserted successfully - ID:', result.rows[0].id)

    // Update work order totals
    console.log('Updating work order totals...')
    await updateWorkOrderTotals(workOrderId)
    console.log('✓ Totals updated')
    console.log('===================================')

    return NextResponse.json({
      item: result.rows[0]
    })
  } catch (error: any) {
    console.error('Error creating work order item:', error)
    return NextResponse.json(
      { error: 'Failed to create item', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/work-orders/[id]/items
 * Update an existing work order item (Excel-style instant save)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    
    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'Invalid work order ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const { item_id, ...updates } = body

    if (!item_id) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      )
    }

    // Build dynamic update query
    const updateFields: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Calculate line_total if quantity or unit_price changed
    if (updates.quantity !== undefined || updates.unit_price !== undefined || 
        updates.labor_hours !== undefined || updates.labor_rate !== undefined) {
      
      // Get current item to calculate line_total
      const currentItem = await pool.query(
        'SELECT item_type, quantity, unit_price, labor_hours, labor_rate FROM work_order_items WHERE id = $1',
        [item_id]
      )
      
      if (currentItem.rows.length > 0) {
        const item = currentItem.rows[0]
        const quantity = updates.quantity ?? item.quantity
        const unit_price = updates.unit_price ?? item.unit_price
        const labor_hours = updates.labor_hours ?? item.labor_hours
        const labor_rate = updates.labor_rate ?? item.labor_rate

        updates.line_total = item.item_type === 'labor'
          ? (labor_hours || 0) * (labor_rate || 160)
          : (quantity || 1) * (unit_price || 0)
      }
    }

    for (const [key, value] of Object.entries(updates)) {
      updateFields.push(`${key} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }

    updateFields.push(`updated_at = NOW()`)

    values.push(item_id)
    values.push(workOrderId)

    const result = await pool.query(`
      UPDATE work_order_items
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND work_order_id = $${paramIndex + 1}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Update work order totals
    await updateWorkOrderTotals(workOrderId)

    return NextResponse.json({
      item: result.rows[0]
    })
  } catch (error: any) {
    console.error('Error updating work order item:', error)
    return NextResponse.json(
      { error: 'Failed to update item', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/work-orders/[id]/items
 * Delete a work order item (Excel-style instant delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    
    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'Invalid work order ID' },
        { status: 400 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item_id')

    if (!itemId) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      )
    }

    const result = await pool.query(
      'DELETE FROM work_order_items WHERE id = $1 AND work_order_id = $2 RETURNING id',
      [parseInt(itemId), workOrderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Update work order totals
    await updateWorkOrderTotals(workOrderId)

    return NextResponse.json({
      success: true,
      deleted_id: parseInt(itemId)
    })
  } catch (error: any) {
    console.error('Error deleting work order item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Update work order totals after items change
 */
async function updateWorkOrderTotals(workOrderId: number) {
  try {
    // Fetch shop settings for tax configuration
    const shopSettings = await pool.query(
      'SELECT sales_tax_rate, parts_taxable, labor_taxable FROM shop_profile LIMIT 1'
    )
    
    const taxRate = parseFloat(shopSettings.rows[0]?.sales_tax_rate || 0)
    const partsTaxable = shopSettings.rows[0]?.parts_taxable ?? true
    const laborTaxable = shopSettings.rows[0]?.labor_taxable ?? false

    // Calculate category totals
    const totals = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN item_type = 'labor' THEN line_total ELSE 0 END), 0) as labor_total,
        COALESCE(SUM(CASE WHEN item_type = 'part' THEN line_total ELSE 0 END), 0) as parts_total,
        COALESCE(SUM(CASE WHEN item_type = 'sublet' THEN line_total ELSE 0 END), 0) as sublets_total,
        COALESCE(SUM(CASE WHEN item_type = 'hazmat' THEN line_total ELSE 0 END), 0) as hazmat_total,
        COALESCE(SUM(CASE WHEN item_type = 'fee' THEN line_total ELSE 0 END), 0) as fees_total,
        COALESCE(SUM(line_total), 0) as subtotal
      FROM work_order_items
      WHERE work_order_id = $1
    `, [workOrderId])

    const t = totals.rows[0]
    
    // Calculate tax based on shop settings
    let taxableAmount = 0
    if (partsTaxable) taxableAmount += parseFloat(t.parts_total)
    if (laborTaxable) taxableAmount += parseFloat(t.labor_total)
    // Sublets, hazmat, and fees are typically always taxable
    taxableAmount += parseFloat(t.sublets_total) + parseFloat(t.hazmat_total) + parseFloat(t.fees_total)
    
    const taxAmount = taxableAmount * taxRate
    const total = parseFloat(t.subtotal) + taxAmount

    await pool.query(`
      UPDATE work_orders
      SET 
        labor_total = $1,
        parts_total = $2,
        sublets_total = $3,
        tax_amount = $4,
        total = $5,
        updated_at = NOW()
      WHERE id = $6
    `, [
      t.labor_total,
      t.parts_total,
      t.sublets_total,
      taxAmount,
      total,
      workOrderId
    ])
  } catch (error: any) {
    console.error('Critical error updating work order totals:', error)
    throw new Error(`Failed to update totals for work order ${workOrderId}: ${error.message}`)
  }
}

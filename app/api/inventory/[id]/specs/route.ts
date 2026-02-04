/**
 * Inventory Spec Update API
 * 
 * Saves AI-extracted specifications to an inventory item.
 * Updates both fluid_specifications and parts_inventory tables.
 * 
 * POST /api/inventory/[id]/specs
 * Body: { extracted: {...}, photoUrl?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const client = await getClient()
  
  try {
    const { extracted, photoUrl } = await request.json()
    const resolvedParams = await Promise.resolve(params)
    const inventoryId = parseInt(resolvedParams.id)
    
    if (isNaN(inventoryId)) {
      return NextResponse.json(
        { error: 'Invalid inventory ID' },
        { status: 400 }
      )
    }

    if (!extracted) {
      return NextResponse.json(
        { error: 'No extracted data provided' },
        { status: 400 }
      )
    }

    console.log(`💾 Saving specs for inventory item ${inventoryId}...`)

    // Start transaction
    await client.query('BEGIN')

    // Check if inventory item exists
    const inventoryCheck = await client.query(
      'SELECT id, part_number, description FROM parts_inventory WHERE id = $1',
      [inventoryId]
    )

    if (inventoryCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    const inventoryItem = inventoryCheck.rows[0]
    console.log(`  ✓ Found: ${inventoryItem.part_number} - ${inventoryItem.description}`)

    // Update parts_inventory with category and flags
    const needsReview = extracted.confidence_score < 0.8
    const isVerified = extracted.confidence_score >= 0.8

    await client.query(`
      UPDATE parts_inventory 
      SET 
        category = 'fluid',
        spec_verified = $1,
        needs_spec_review = $2,
        label_photo_url = $3,
        has_detailed_specs = true,
        last_updated = NOW()
      WHERE id = $4
    `, [
      isVerified,
      needsReview,
      photoUrl || null,
      inventoryId
    ])

    console.log(`  ✓ Updated parts_inventory`)

    // Prepare OEM approvals as JSONB array of normalized codes
    const oemApprovalsArray = extracted.oem_approvals?.map((approval: any) => 
      approval.normalized_code
    ) || []

    // Insert or update fluid_specifications
    const specResult = await client.query(`
      INSERT INTO fluid_specifications (
        inventory_id,
        fluid_type,
        base_stock,
        viscosity,
        api_service_class,
        acea_class,
        ilsac_class,
        jaso_class,
        oem_approvals,
        low_saps,
        high_mileage,
        product_name,
        container_size,
        confidence_score,
        extraction_method,
        extraction_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (inventory_id) 
      DO UPDATE SET
        fluid_type = EXCLUDED.fluid_type,
        base_stock = EXCLUDED.base_stock,
        viscosity = EXCLUDED.viscosity,
        api_service_class = EXCLUDED.api_service_class,
        acea_class = EXCLUDED.acea_class,
        ilsac_class = EXCLUDED.ilsac_class,
        jaso_class = EXCLUDED.jaso_class,
        oem_approvals = EXCLUDED.oem_approvals,
        low_saps = EXCLUDED.low_saps,
        high_mileage = EXCLUDED.high_mileage,
        product_name = EXCLUDED.product_name,
        container_size = EXCLUDED.container_size,
        confidence_score = EXCLUDED.confidence_score,
        extraction_date = EXCLUDED.extraction_date,
        updated_at = NOW()
      RETURNING id
    `, [
      inventoryId,
      extracted.fluid_type || null,
      extracted.base_stock || null,
      extracted.viscosity || null,
      extracted.api_service_class || null,
      extracted.acea_class || null,
      extracted.ilsac_class || null,
      extracted.jaso_class || null,
      JSON.stringify(oemApprovalsArray),
      extracted.low_saps || false,
      extracted.high_mileage || false,
      extracted.product_name || null,
      extracted.container_size || null,
      extracted.confidence_score || 0,
      'gemini_vision' // extraction_method
    ])

    console.log(`  ✓ Saved fluid_specifications (ID: ${specResult.rows[0].id})`)

    // Commit transaction
    await client.query('COMMIT')

    console.log(`✅ Specs saved successfully - ${needsReview ? 'NEEDS REVIEW' : 'VERIFIED'}`)

    // Return updated inventory item with specs
    const updatedItem = await query(`
      SELECT 
        p.*,
        f.fluid_type,
        f.base_stock,
        f.viscosity,
        f.api_service_class,
        f.acea_class,
        f.ilsac_class,
        f.jaso_class,
        f.oem_approvals,
        f.low_saps,
        f.high_mileage,
        f.product_name,
        f.container_size,
        f.confidence_score,
        f.extraction_date
      FROM parts_inventory p
      LEFT JOIN fluid_specifications f ON p.id = f.inventory_id
      WHERE p.id = $1
    `, [inventoryId])

    return NextResponse.json({
      success: true,
      message: needsReview 
        ? 'Specifications saved - needs manual review'
        : 'Specifications saved and verified',
      needs_review: needsReview,
      confidence_score: extracted.confidence_score,
      inventory_item: updatedItem.rows[0]
    })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Spec update error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update specifications',
        details: error.message
      },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

/**
 * GET /api/inventory/[id]/specs
 * Retrieve specifications for an inventory item
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const inventoryId = parseInt(resolvedParams.id)
    
    if (isNaN(inventoryId)) {
      return NextResponse.json(
        { error: 'Invalid inventory ID' },
        { status: 400 }
      )
    }

    const result = await query(`
      SELECT 
        p.id,
        p.part_number,
        p.description,
        p.category,
        p.spec_verified,
        p.needs_spec_review,
        p.label_photo_url,
        p.has_detailed_specs,
        f.fluid_type,
        f.base_stock,
        f.viscosity,
        f.api_service_class,
        f.acea_class,
        f.ilsac_class,
        f.jaso_class,
        f.oem_approvals,
        f.low_saps,
        f.high_mileage,
        f.product_name,
        f.container_size,
        f.confidence_score,
        f.extraction_method,
        f.extraction_date,
        f.verified_by,
        f.verified_at
      FROM parts_inventory p
      LEFT JOIN fluid_specifications f ON p.id = f.inventory_id
      WHERE p.id = $1
    `, [inventoryId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error: any) {
    console.error('Get specs error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve specifications',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/[id]/specs
 * Remove specifications from an inventory item
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const inventoryId = parseInt(resolvedParams.id)
    
    if (isNaN(inventoryId)) {
      return NextResponse.json(
        { error: 'Invalid inventory ID' },
        { status: 400 }
      )
    }

    // Delete will cascade due to ON DELETE CASCADE
    await query(
      'DELETE FROM fluid_specifications WHERE inventory_id = $1',
      [inventoryId]
    )

    // Reset inventory flags
    await query(`
      UPDATE parts_inventory 
      SET 
        spec_verified = false,
        needs_spec_review = false,
        has_detailed_specs = false,
        label_photo_url = NULL
      WHERE id = $1
    `, [inventoryId])

    return NextResponse.json({
      success: true,
      message: 'Specifications removed'
    })

  } catch (error: any) {
    console.error('Delete specs error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete specifications',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Save Scanned Product to Database
 * 
 * Creates or updates a parts_inventory record + fluid_specifications from AI scan data.
 * Preserves financial data (cost/price/quantity) from ShopWare imports when updating.
 * 
 * POST /api/inventory/scan-product/save
 * Body: JSON with scan result data
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  const client = await getClient()

  try {
    const body = await request.json()
    const { scanResult, frontImageData, backImageData } = body

    if (!scanResult) {
      return NextResponse.json(
        { error: 'No scan result provided' },
        { status: 400 }
      )
    }

    console.log(`💾 Saving scanned product: ${scanResult.partNumber} (${scanResult.brand} ${scanResult.productName})`)

    await client.query('BEGIN')

    // Save uploaded images to disk if provided
    let frontImageUrl: string | null = null
    let backImageUrl: string | null = null

    if (frontImageData || backImageData) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'scans')
      await mkdir(uploadsDir, { recursive: true })
      const timestamp = Date.now()

      if (frontImageData) {
        const fileName = `${scanResult.partNumber}_front_${timestamp}.jpg`
        const filePath = path.join(uploadsDir, fileName)
        const buffer = Buffer.from(frontImageData, 'base64')
        await writeFile(filePath, buffer)
        frontImageUrl = `/uploads/scans/${fileName}`
      }

      if (backImageData) {
        const fileName = `${scanResult.partNumber}_back_${timestamp}.jpg`
        const filePath = path.join(uploadsDir, fileName)
        const buffer = Buffer.from(backImageData, 'base64')
        await writeFile(filePath, buffer)
        backImageUrl = `/uploads/scans/${fileName}`
      }
    }

    // Build approvals string for parts_inventory.approvals column
    const approvalsParts: string[] = []
    if (scanResult.apiClass) approvalsParts.push(`API ${scanResult.apiClass}`)
    if (scanResult.aceaClass) approvalsParts.push(`ACEA ${scanResult.aceaClass}`)
    if (scanResult.ilsacClass) approvalsParts.push(`ILSAC ${scanResult.ilsacClass}`)
    if (scanResult.jasoClass) approvalsParts.push(`JASO ${scanResult.jasoClass}`)
    if (scanResult.oemApprovals && scanResult.oemApprovals.length > 0) {
      scanResult.oemApprovals.forEach((a: any) => {
        approvalsParts.push(a.normalizedCode || a.rawText)
      })
    }
    const approvalsString = approvalsParts.length > 0 ? approvalsParts.join(', ') : null

    // OEM approvals as JSONB array of codes
    const oemApprovalsJson = scanResult.oemApprovals?.map((a: any) => a.normalizedCode) || []

    const now = new Date().toISOString()

    // Check if part already exists
    const existingPart = await client.query(
      'SELECT id, cost, price, cost_per_quart, price_per_quart, quantity_on_hand, quantity_available, quantity_allocated, shopware_id, data_source FROM parts_inventory WHERE part_number = $1',
      [scanResult.partNumber]
    )

    let partId: number

    if (existingPart.rows.length > 0) {
      // ========== UPDATE existing part ==========
      const existing = existingPart.rows[0]
      partId = existing.id
      console.log(`  📝 Updating existing part ID ${partId}`)

      // Preserve financial data from ShopWare (parseFloat since pg returns strings for numeric)
      const costPerQuart = parseFloat(existing.cost_per_quart) || parseFloat(existing.cost) || 0
      const pricePerQuart = parseFloat(existing.price_per_quart) || parseFloat(existing.price) || 0

      await client.query(`
        UPDATE parts_inventory SET
          -- Product data from AI scan (overwrite)
          part_number_source = $1,
          manufacturer_part_number = $2,
          barcode_upc = $3,
          description = $4,
          vendor = $5,
          category = $6,
          container_size = $7,
          container_type = $8,
          base_unit_quantity = $9,
          
          -- Preserve financial data
          cost_per_quart = $10,
          price_per_quart = $11,
          margin_percent = CASE 
            WHEN $11::numeric > 0 THEN ROUND((($11::numeric - $10::numeric) / $11::numeric * 100)::numeric, 2)
            ELSE 0
          END,
          
          -- Spec tracking
          has_detailed_specs = true,
          spec_verified = $12,
          needs_spec_review = $13,
          approvals = $14,
          confidence_score = $15,
          last_scanned_at = $16,
          scan_image_front_url = COALESCE($17, scan_image_front_url),
          scan_image_back_url = COALESCE($18, scan_image_back_url),
          data_source = 'ai_scan',
          last_updated = $16
        WHERE id = $19
      `, [
        scanResult.partNumberSource,
        scanResult.manufacturerPartNumber,
        scanResult.barcode,
        scanResult.description,
        scanResult.brand,
        scanResult.category,
        scanResult.containerSize,
        scanResult.containerType,
        scanResult.baseUnitQuantity,
        costPerQuart,
        pricePerQuart,
        scanResult.confidenceScore >= 0.8,
        scanResult.needsReview,
        approvalsString,
        scanResult.confidenceScore,
        now,
        frontImageUrl,
        backImageUrl,
        partId
      ])

      console.log(`  ✓ Updated parts_inventory (preserved cost: $${costPerQuart}/qt, price: $${pricePerQuart}/qt)`)

    } else {
      // ========== CREATE new part ==========
      console.log(`  🆕 Creating new part: ${scanResult.partNumber}`)

      const insertResult = await client.query(`
        INSERT INTO parts_inventory (
          part_number, part_number_source, manufacturer_part_number, barcode_upc,
          description, vendor, category,
          container_size, container_type, base_unit_quantity,
          cost_per_quart, price_per_quart, margin_percent,
          has_detailed_specs, spec_verified, needs_spec_review,
          approvals, confidence_score, last_scanned_at,
          scan_image_front_url, scan_image_back_url,
          data_source, created_at, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          0, 0, 0,
          true, $11, $12,
          $13, $14, $15,
          $16, $17,
          'ai_scan', $15, $15
        ) RETURNING id
      `, [
        scanResult.partNumber,
        scanResult.partNumberSource,
        scanResult.manufacturerPartNumber,
        scanResult.barcode,
        scanResult.description,
        scanResult.brand,
        scanResult.category,
        scanResult.containerSize,
        scanResult.containerType,
        scanResult.baseUnitQuantity,
        scanResult.confidenceScore >= 0.8,
        scanResult.needsReview,
        approvalsString,
        scanResult.confidenceScore,
        now,
        frontImageUrl,
        backImageUrl
      ])

      partId = insertResult.rows[0].id
      console.log(`  ✓ Created parts_inventory ID ${partId}`)
    }

    // ========== Upsert fluid_specifications ==========
    const specResult = await client.query(`
      INSERT INTO fluid_specifications (
        inventory_id,
        fluid_type, base_stock, viscosity,
        api_service_class, acea_class, ilsac_class, jaso_class,
        oem_approvals, oem_approvals_text,
        low_saps, high_mileage, racing_formula, diesel_specific,
        color,
        product_name, container_size,
        confidence_score, extraction_method, extraction_raw,
        extraction_date, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, 'ai_vision', $19,
        NOW(), NOW()
      )
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
        oem_approvals_text = EXCLUDED.oem_approvals_text,
        low_saps = EXCLUDED.low_saps,
        high_mileage = EXCLUDED.high_mileage,
        racing_formula = EXCLUDED.racing_formula,
        diesel_specific = EXCLUDED.diesel_specific,
        color = EXCLUDED.color,
        product_name = EXCLUDED.product_name,
        container_size = EXCLUDED.container_size,
        confidence_score = EXCLUDED.confidence_score,
        extraction_raw = EXCLUDED.extraction_raw,
        extraction_date = NOW(),
        updated_at = NOW()
      RETURNING id
    `, [
      partId,
      scanResult.fluidType,
      scanResult.baseStockType,
      scanResult.viscosity,
      scanResult.apiClass,
      scanResult.aceaClass,
      scanResult.ilsacClass,
      scanResult.jasoClass,
      JSON.stringify(oemApprovalsJson),
      scanResult.oemApprovalsRawText,
      scanResult.lowSaps || false,
      scanResult.highMileage || false,
      scanResult.racingFormula || false,
      scanResult.dieselSpecific || false,
      scanResult.color,
      scanResult.productName,
      scanResult.containerSize,
      scanResult.confidenceScore,
      scanResult.extractionRaw
    ])

    console.log(`  ✓ Saved fluid_specifications (ID: ${specResult.rows[0].id})`)

    await client.query('COMMIT')

    const isUpdate = existingPart.rows.length > 0
    console.log(`✅ Product ${isUpdate ? 'updated' : 'created'} successfully - Part #${scanResult.partNumber} (ID: ${partId})`)

    return NextResponse.json({
      success: true,
      message: `Product ${isUpdate ? 'updated' : 'created'} successfully`,
      partId,
      partNumber: scanResult.partNumber,
      isUpdate,
      needsReview: scanResult.needsReview,
      frontImageUrl,
      backImageUrl
    })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('=== SAVE PRODUCT ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      {
        error: 'Failed to save product',
        details: error.message
      },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

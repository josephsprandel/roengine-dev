import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'

// POST /api/settings/shop-logo - Upload shop logo
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP, SVG' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'shop')
    await mkdir(uploadsDir, { recursive: true })

    // Generate unique filename with timestamp
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filename = `shop-logo-${Date.now()}.${extension}`
    const filepath = path.join(uploadsDir, filename)

    // Delete old logo if exists
    const existingProfile = await query(`SELECT logo_url FROM shop_profile LIMIT 1`)
    if (existingProfile.rows[0]?.logo_url) {
      const oldPath = path.join(process.cwd(), 'public', existingProfile.rows[0].logo_url)
      try {
        await unlink(oldPath)
      } catch (e) {
        // Ignore if file doesn't exist
      }
    }

    // Write the new file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Store the relative URL in the database
    const logoUrl = `/uploads/shop/${filename}`
    
    await query(`
      UPDATE shop_profile 
      SET logo_url = $1, updated_at = NOW()
      WHERE id = (SELECT id FROM shop_profile LIMIT 1)
    `, [logoUrl])

    return NextResponse.json({
      success: true,
      logo_url: logoUrl,
      message: 'Logo uploaded successfully'
    })
  } catch (error: any) {
    console.error('Error uploading logo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/settings/shop-logo - Remove shop logo
export async function DELETE() {
  try {
    // Get current logo
    const result = await query(`SELECT logo_url FROM shop_profile LIMIT 1`)
    const logoUrl = result.rows[0]?.logo_url

    if (logoUrl) {
      // Delete the file
      const filepath = path.join(process.cwd(), 'public', logoUrl)
      try {
        await unlink(filepath)
      } catch (e) {
        // Ignore if file doesn't exist
      }

      // Clear the database field
      await query(`
        UPDATE shop_profile 
        SET logo_url = NULL, updated_at = NOW()
        WHERE id = (SELECT id FROM shop_profile LIMIT 1)
      `)
    }

    return NextResponse.json({
      success: true,
      message: 'Logo removed successfully'
    })
  } catch (error: any) {
    console.error('Error removing logo:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

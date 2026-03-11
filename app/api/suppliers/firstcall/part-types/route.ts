import { NextResponse } from 'next/server';

/**
 * GET /api/suppliers/firstcall/part-types
 * Returns available part types from First Call's most popular navigation.
 * Uses category IDs which work directly in the products endpoint.
 */
export async function GET() {
  try {
    const firstcall = require('@/backend/services/firstcall-api');
    await firstcall.ensureSession();
    const partTypes = await firstcall.getPartTypes();

    // Normalize to a clean list with id + name
    const types = (partTypes || [])
      .filter((pt: any) => pt.hasParts)
      .map((pt: any) => ({
        id: pt.partTypeId,
        name: pt.description || pt.partTypeName,
        platformId: pt.platformId,
      }));

    return NextResponse.json({ success: true, partTypes: types });
  } catch (err: any) {
    console.error('[firstcall/part-types]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch part types' },
      { status: 500 }
    );
  }
}

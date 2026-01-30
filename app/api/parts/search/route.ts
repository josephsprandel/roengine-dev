import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/parts/search
 * 
 * Search for parts using PartsTech automation
 * 
 * Body: {
 *   vin: string;
 *   searchTerm: string;
 *   mode: 'manual' | 'ai';
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vin, searchTerm, mode = 'manual' } = body;

    // Validate inputs
    if (!vin || vin.length !== 17) {
      return NextResponse.json(
        { success: false, error: 'Valid 17-character VIN required' },
        { status: 400 }
      );
    }

    if (!searchTerm || searchTerm.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Search term required' },
        { status: 400 }
      );
    }

    // Import the new GraphQL API module (only on server side)
    const { searchPartsTech } = require('@/backend/services/partstech-api');

    console.log(`[Parts Search API] VIN: ${vin}, Search: ${searchTerm}, Mode: ${mode}`);

    // Execute the search using direct GraphQL API
    const result = await searchPartsTech(vin, searchTerm, { mode });

    // Check for errors
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error?.message || 'Search failed',
          errorCode: result.error?.code 
        },
        { status: 500 }
      );
    }

    // Return results
    return NextResponse.json({
      success: true,
      data: {
        vehicle: result.vehicle,
        searchTerm: result.search_term,
        partType: result.part_type,
        mode: result.mode,
        vendors: result.vendors,
        totalVendors: result.total_vendors,
        totalParts: result.total_parts_found,
        duration: result.duration_seconds,
        timestamp: result.timestamp,
      },
    });

  } catch (error: any) {
    console.error('[Parts Search API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

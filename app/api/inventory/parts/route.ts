/**
 * Parts Inventory API
 * 
 * GET: Fetch parts inventory with search and sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    // Delete all parts from inventory
    const result = await pool.query('DELETE FROM parts_inventory');
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${result.rowCount} parts from inventory`
    });
  } catch (error: any) {
    console.error('[Inventory Delete API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete parts',
      details: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'part_number';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate sortBy to prevent SQL injection
    const validSortColumns = [
      'part_number',
      'description',
      'quantity_available',
      'quantity_on_hand',
      'cost',
      'price',
      'vendor',
      'location',
      'category'
    ];

    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'part_number';
    const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Build query
    let query = `
      SELECT 
        id,
        part_number,
        description,
        vendor,
        cost,
        price,
        quantity_on_hand,
        quantity_available,
        quantity_allocated,
        reorder_point,
        location,
        bin_location,
        category,
        notes,
        approvals,
        shopware_id,
        last_synced_at,
        last_updated,
        created_at
      FROM parts_inventory
      WHERE 1=1
    `;

    const params: any[] = [];

    // Add search filter
    if (search && search.trim().length > 0) {
      params.push(`%${search}%`, search);
      query += ` AND (
        LOWER(part_number) LIKE LOWER($${params.length - 1})
        OR LOWER(description) LIKE LOWER($${params.length - 1})
        OR LOWER(vendor) LIKE LOWER($${params.length - 1})
        OR to_tsvector('english', description) @@ plainto_tsquery('english', $${params.length})
      )`;
    }

    // Add sorting
    query += ` ORDER BY ${sortColumn} ${order}`;

    // Add pagination
    params.push(limit, offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // Execute query
    const result = await pool.query(query, params);

    // Convert numeric fields to numbers (PostgreSQL returns them as strings)
    const parts = result.rows.map(row => ({
      ...row,
      cost: parseFloat(row.cost) || 0,
      price: parseFloat(row.price) || 0,
      quantity_on_hand: parseInt(row.quantity_on_hand) || 0,
      quantity_available: parseInt(row.quantity_available) || 0,
      quantity_allocated: parseInt(row.quantity_allocated) || 0,
      reorder_point: parseInt(row.reorder_point) || 0
    }));

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM parts_inventory WHERE 1=1';
    const countParams: any[] = [];

    if (search && search.trim().length > 0) {
      countParams.push(`%${search}%`, search);
      countQuery += ` AND (
        LOWER(part_number) LIKE LOWER($1)
        OR LOWER(description) LIKE LOWER($1)
        OR LOWER(vendor) LIKE LOWER($1)
        OR to_tsvector('english', description) @@ plainto_tsquery('english', $2)
      )`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      success: true,
      parts: parts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + parts.length < total
      }
    });

  } catch (error: any) {
    console.error('[Inventory Parts API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch parts',
      details: error.message
    }, { status: 500 });
  }
}

#!/usr/bin/env node
/**
 * Test script for 2019 Subaru Forester Oil Filter
 * 
 * This test verifies that PartsTech returns vehicle-specific parts.
 * Expected: Part #27055 (or similar compatible NAPA filter)
 * NOT Expected: 21036, 21365, 21361, 21060, 27099 (incompatible)
 */

const { searchPartsTech, cleanup } = require('../backend/services/partstech-api');

// 2019 Subaru Forester - Use a valid VIN format
const TEST_VIN = 'JF2SKACC5KH401234';
const SEARCH_TERM = 'oil filter';

// Known incompatible parts (should NOT appear in results)
const WRONG_PARTS = ['21036', '21365', '21361', '21060', '27099'];

// Expected correct part
const EXPECTED_PART = '27055';

async function runTest() {
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║  2019 SUBARU FORESTER OIL FILTER TEST                               ║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('\n');
  console.log('VIN:', TEST_VIN);
  console.log('Search Term:', SEARCH_TERM);
  console.log('Expected Part:', EXPECTED_PART);
  console.log('Wrong Parts (should NOT appear):', WRONG_PARTS.join(', '));
  console.log('\n' + '─'.repeat(70) + '\n');

  try {
    const result = await searchPartsTech(TEST_VIN, SEARCH_TERM, { mode: 'manual' });

    if (!result.success) {
      console.log('\n❌ SEARCH FAILED');
      console.log('Error Code:', result.error?.code);
      console.log('Error Message:', result.error?.message);
      await cleanup();
      process.exit(1);
    }

    console.log('\n' + '─'.repeat(70));
    console.log('TEST RESULTS');
    console.log('─'.repeat(70) + '\n');

    console.log('Vehicle Decoded:', `${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}`);
    console.log('Vehicle ID:', result.vehicle.id);
    console.log('Total Parts Found:', result.total_parts_found);
    console.log('Duration:', result.duration_seconds, 'seconds');

    // Get all part numbers
    const allPartNumbers = result.vendors
      .flatMap(v => v.parts.map(p => p.part_number));

    console.log('\nPart Numbers Returned:');
    allPartNumbers.forEach((pn, i) => console.log(`  ${i + 1}. ${pn}`));

    // Check for wrong parts
    console.log('\n' + '─'.repeat(70));
    console.log('VALIDATION');
    console.log('─'.repeat(70) + '\n');

    const foundWrongParts = allPartNumbers.filter(pn => 
      WRONG_PARTS.includes(pn)
    );

    const foundCorrectPart = allPartNumbers.includes(EXPECTED_PART);

    if (foundWrongParts.length > 0) {
      console.log('❌ FAIL: Found INCOMPATIBLE parts:');
      foundWrongParts.forEach(pn => console.log(`   - ${pn}`));
      console.log('\n   This indicates vehicle filtering is NOT working!');
    } else {
      console.log('✅ PASS: No incompatible parts found');
    }

    if (foundCorrectPart) {
      console.log(`✅ PASS: Found expected part ${EXPECTED_PART}`);
    } else {
      console.log(`⚠️  WARNING: Expected part ${EXPECTED_PART} not in results`);
      console.log('   (This may be OK if other compatible parts are present)');
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    if (foundWrongParts.length === 0) {
      console.log('✅ TEST PASSED - Vehicle filtering appears to be working');
    } else {
      console.log('❌ TEST FAILED - Vehicle filtering is NOT working');
      console.log('   PartsTech is returning parts for wrong vehicles!');
    }
    console.log('═'.repeat(70) + '\n');

    await cleanup();
    process.exit(foundWrongParts.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ EXCEPTION:', error.message);
    console.error(error.stack);
    await cleanup();
    process.exit(1);
  }
}

runTest();

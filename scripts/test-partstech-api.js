#!/usr/bin/env node
/**
 * Test script for PartsTech GraphQL API integration
 * 
 * Tests the fast, direct API approach vs old browser automation
 * Expected performance: 3-5 seconds per search (after initial login)
 */

const { searchPartsTech, cleanup } = require('../backend/services/partstech-api');

// Test cases
const TEST_CASES = [
  {
    name: 'BMW Oil Filter',
    vin: 'WBXPC9C46AWJ32397',
    searchTerm: 'oil filter',
    mode: 'manual'
  },
  {
    name: 'Ford Fusion Brake Pads',
    vin: '3FAHP0JG3CR449015',
    searchTerm: 'brake pads',
    mode: 'manual'
  },
  {
    name: 'Honda Accord Air Filter (AI mode)',
    vin: '1HGCV1F30KA001234',
    searchTerm: 'air filter',
    mode: 'ai'
  }
];

async function runTest(testCase) {
  console.log('\n' + '='.repeat(80));
  console.log(`TEST: ${testCase.name}`);
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  try {
    const result = await searchPartsTech(testCase.vin, testCase.searchTerm, { 
      mode: testCase.mode 
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.success) {
      console.log('\n✅ TEST PASSED');
      console.log(`\n📊 Results:`);
      console.log(`   Vehicle: ${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}`);
      if (result.vehicle.engine) {
        console.log(`   Engine: ${result.vehicle.engine}`);
      }
      console.log(`   Part Type: ${result.part_type?.name || 'N/A'}`);
      console.log(`   Vendors: ${result.total_vendors}`);
      console.log(`   Parts Found: ${result.total_parts_found}`);
      console.log(`   Mode: ${result.mode}`);
      console.log(`   Duration: ${result.duration_seconds}s`);
      
      // Show sample parts from each vendor
      console.log(`\n📦 Parts by Vendor:`);
      result.vendors.forEach((vendor, idx) => {
        console.log(`\n   ${idx + 1}. ${vendor.vendor} (${vendor.parts.length} parts)`);
        
        // Show first 2 parts
        vendor.parts.slice(0, 2).forEach((part, partIdx) => {
          console.log(`      ${partIdx + 1}. ${part.part_number} - ${part.brand}`);
          console.log(`         ${part.description || 'No description'}`);
          console.log(`         Price: $${part.price?.toFixed(2) || 'N/A'} | Stock: ${part.stock_status}`);
          if (part.store_location) {
            console.log(`         Location: ${part.store_location}`);
          }
        });
        
        if (vendor.parts.length > 2) {
          console.log(`      ... and ${vendor.parts.length - 2} more`);
        }
      });
      
      // Performance check
      console.log(`\n⏱️  Performance Analysis:`);
      const targetTime = 5.0;
      if (result.duration_seconds <= targetTime) {
        console.log(`   ✅ EXCELLENT - ${result.duration_seconds}s (target: ${targetTime}s)`);
      } else if (result.duration_seconds <= targetTime * 2) {
        console.log(`   ⚠️  ACCEPTABLE - ${result.duration_seconds}s (target: ${targetTime}s)`);
      } else {
        console.log(`   ❌ SLOW - ${result.duration_seconds}s (target: ${targetTime}s)`);
      }
      
      return { success: true, duration: result.duration_seconds };
      
    } else {
      console.log('\n❌ TEST FAILED');
      console.log(`   Error Code: ${result.error?.code}`);
      console.log(`   Error: ${result.error?.message}`);
      console.log(`   Duration: ${result.duration_seconds}s`);
      return { success: false, duration: result.duration_seconds, error: result.error };
    }
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n❌ TEST EXCEPTION');
    console.log(`   Error: ${error.message}`);
    console.log(`   Duration: ${duration}s`);
    return { success: false, duration: parseFloat(duration), error: error.message };
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'PartsTech GraphQL API Test Suite' + ' '.repeat(26) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  const results = [];
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    const result = await runTest(testCase);
    results.push({ testCase, result });
    
    // Wait a bit between tests
    if (i < TEST_CASES.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.result.duration, 0) / results.length;
  
  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Average Duration: ${avgDuration.toFixed(1)}s`);
  
  // Performance rating
  console.log(`\n📈 Overall Performance:`);
  if (avgDuration <= 5) {
    console.log(`   ✅ EXCELLENT - Meeting target of 3-5 seconds`);
  } else if (avgDuration <= 10) {
    console.log(`   ⚠️  GOOD - Slightly above target but acceptable`);
  } else {
    console.log(`   ❌ NEEDS OPTIMIZATION - Significantly above target`);
  }
  
  // Comparison to old approach
  const oldApproachTime = 30; // seconds
  const speedup = (oldApproachTime / avgDuration).toFixed(1);
  const timeSaved = (oldApproachTime - avgDuration).toFixed(1);
  
  console.log(`\n🚀 Improvement vs Old Automation:`);
  console.log(`   Old approach: ~${oldApproachTime}s per search`);
  console.log(`   New approach: ~${avgDuration.toFixed(1)}s per search`);
  console.log(`   Speedup: ${speedup}x faster`);
  console.log(`   Time saved: ${timeSaved}s per search`);
  
  // Cost savings (assuming old approach used Gemini)
  const geminiCostPerSearch = 0.15; // dollars
  const searchesPerDay = 100;
  const dailySavings = geminiCostPerSearch * searchesPerDay;
  const monthlySavings = dailySavings * 30;
  
  console.log(`\n💰 Cost Savings (estimated):`);
  console.log(`   Old: $${geminiCostPerSearch.toFixed(2)} per search (Gemini API)`);
  console.log(`   New: $0.00 per search (direct API)`);
  console.log(`   Daily savings (${searchesPerDay} searches): $${dailySavings.toFixed(2)}`);
  console.log(`   Monthly savings: $${monthlySavings.toFixed(2)}`);
  
  console.log('\n' + '='.repeat(80));
  
  // Cleanup
  await cleanup();
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Handle errors gracefully
process.on('unhandledRejection', async (error) => {
  console.error('\n❌ Unhandled error:', error);
  await cleanup();
  process.exit(1);
});

// Run tests
runAllTests().catch(async (error) => {
  console.error('\n❌ Test suite error:', error);
  await cleanup();
  process.exit(1);
});

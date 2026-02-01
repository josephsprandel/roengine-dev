#!/usr/bin/env node
/**
 * Test script to investigate PartsTech cross-reference data
 * 
 * Run: node scripts/test-partstech-crossref.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const { searchPartsTech, ensureSession, graphqlQuery } = require('../backend/services/partstech-api');

// Test with 2019 Subaru Forester
const TEST_VIN = 'JF2SJAEC7KH401232';  // Valid 2019 Forester VIN pattern
const TEST_SEARCH = 'oil filter';

async function investigateCrossReferences() {
  console.log('═'.repeat(70));
  console.log('PARTSTECH CROSS-REFERENCE INVESTIGATION');
  console.log('═'.repeat(70));
  console.log('\nObjective: Check if PartsTech returns cross-reference/interchange data\n');

  try {
    // Step 1: Run a normal search with debug logging
    console.log('Step 1: Running standard search with debug logging...\n');
    const results = await searchPartsTech(TEST_VIN, TEST_SEARCH, { mode: 'manual' });

    if (!results.success) {
      console.error('Search failed:', results.error);
      return;
    }

    console.log(`\n✓ Search completed - found ${results.total_parts_found} parts\n`);

    // Step 2: Try requesting additional fields via GraphQL introspection
    console.log('\n═'.repeat(70));
    console.log('Step 2: Testing GraphQL Introspection for Product type...');
    console.log('═'.repeat(70));

    const cookies = await ensureSession();

    // Try introspection query
    const introspectionQuery = `
      query {
        __type(name: "Product") {
          name
          fields {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    `;

    try {
      const schemaData = await graphqlQuery(introspectionQuery, {}, 'IntrospectionQuery', cookies);
      
      if (schemaData && schemaData.__type) {
        console.log('\n✓ Product type fields from GraphQL schema:\n');
        const fields = schemaData.__type.fields || [];
        
        fields.forEach(f => {
          const typeName = f.type.name || 
            (f.type.ofType ? `[${f.type.ofType.name}]` : f.type.kind);
          console.log(`  - ${f.name}: ${typeName}`);
        });

        // Look for cross-reference related fields
        console.log('\n═'.repeat(70));
        console.log('Searching for cross-reference related fields...');
        console.log('═'.repeat(70));

        const xrefKeywords = ['cross', 'interchange', 'alternate', 'equivalent', 'supersede', 'replace'];
        const foundXref = fields.filter(f => 
          xrefKeywords.some(kw => f.name.toLowerCase().includes(kw))
        );

        if (foundXref.length > 0) {
          console.log('\n✓ FOUND CROSS-REFERENCE FIELDS:');
          foundXref.forEach(f => console.log(`  - ${f.name}`));
        } else {
          console.log('\n⚠️ No obvious cross-reference fields found in Product type.');
          console.log('   Cross-references may be in a separate query or not available.');
        }
      }
    } catch (err) {
      console.log('\n⚠️ Introspection query failed (may be disabled):', err.message);
      console.log('   Will need to check PartsTech API documentation.');
    }

    // Step 3: Summary
    console.log('\n═'.repeat(70));
    console.log('INVESTIGATION SUMMARY');
    console.log('═'.repeat(70));
    console.log(`
Check the debug output above for:
1. RAW FIRST PRODUCT - shows ALL fields returned
2. "All keys in product object" - quick list of available fields
3. GraphQL schema introspection (if available)

If no cross-reference fields exist, alternatives:
- Build our own cross-reference table
- Use external ACES/PIES data
- Standardize on single numbering system (NAPA-only)
`);

  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

// Run the investigation
investigateCrossReferences()
  .then(() => {
    console.log('\nInvestigation complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

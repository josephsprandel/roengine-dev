import { query } from '@/lib/db'

async function migrateColors() {
  console.log('Migrating vehicle colors to new 16-color palette...')

  const updates = await query(`
    UPDATE vehicles
    SET color = CASE
      WHEN LOWER(color) = 'brown' THEN 'bronze'
      WHEN LOWER(color) = 'gold' THEN 'yellow'
      ELSE LOWER(color)
    END
    WHERE color IS NOT NULL
  `)

  console.log(`Updated ${updates.rowCount} vehicles`)

  const results = await query(`
    SELECT color, COUNT(*) as count
    FROM vehicles
    WHERE color IS NOT NULL
    GROUP BY color
    ORDER BY count DESC
  `)

  console.log('Current color distribution:')
  console.table(results.rows)

  process.exit(0)
}

migrateColors().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

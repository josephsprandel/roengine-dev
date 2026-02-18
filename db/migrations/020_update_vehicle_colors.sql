-- Migration 020: Update vehicle colors to new 16-color standardized palette
-- Old palette: Red, Blue, White, Black, Silver, Gray, Green, Yellow, Orange, Brown, Beige, Gold
-- New palette: white, black, silver, gray, red, blue, bronze, green, beige, orange, yellow, purple, lightblue, darkblue, burgundy, tan
--
-- Mappings: Brown → bronze, Gold → yellow, all others → lowercase

-- Migrate renamed colors
UPDATE vehicles
SET color = 'bronze'
WHERE LOWER(color) = 'brown';

UPDATE vehicles
SET color = 'yellow'
WHERE LOWER(color) = 'gold';

-- Normalize case (ensure all lowercase)
UPDATE vehicles
SET color = LOWER(color)
WHERE color IS NOT NULL
  AND color != LOWER(color);

-- Verify migration
SELECT
  color,
  COUNT(*) as count
FROM vehicles
WHERE color IS NOT NULL
GROUP BY color
ORDER BY count DESC;

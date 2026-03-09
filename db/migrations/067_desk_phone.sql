-- Add desk_phone to shop_profile for click-to-call bridge
ALTER TABLE shop_profile
  ADD COLUMN IF NOT EXISTS desk_phone VARCHAR(20);

-- Pre-populate with AutoHouse desk phone
UPDATE shop_profile SET desk_phone = '4792717600' WHERE desk_phone IS NULL;

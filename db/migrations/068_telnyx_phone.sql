-- Add telnyx_phone to shop_profile for provisioned Telnyx number
ALTER TABLE shop_profile
  ADD COLUMN IF NOT EXISTS telnyx_phone VARCHAR(20);

-- AutoHouse: leave null — provisioned manually via Telnyx portal

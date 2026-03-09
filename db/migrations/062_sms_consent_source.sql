-- Track where SMS consent was collected
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_consent_source VARCHAR(20);
-- Values: 'website_modal', 'phone_agent', 'in_person', 'unknown'

COMMENT ON COLUMN customers.sms_consent_source IS 'Where SMS consent was collected: website_modal, phone_agent, in_person, unknown';

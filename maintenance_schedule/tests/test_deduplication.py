"""
Deduplication Tests

Verifies that powertrain config deduplication works correctly:
- Two Volvos with same engine/trans/drive share one powertrain_configs row
- Two vehicle_applications rows point to the same config
- Maintenance schedules are NOT duplicated
- Gemini ingestion log correctly marks duplicate configs

Edge cases:
- Same engine code but different drive type (FWD vs AWD) = separate configs
- Same engine code but different transmission = separate configs
- Mercedes: same platform, different engine codes = separate schedule entries
  with applies_to_engine_codes filter, NOT separate configs
"""

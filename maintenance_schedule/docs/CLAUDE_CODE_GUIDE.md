# RO Engine: Maintenance Schedule Database
## Claude Code Implementation Guide

---

## Project Context

This project adds a universal maintenance schedule database to the existing RO Engine server. The database stores OEM maintenance requirements for all vehicle makes/models/years, normalized by powertrain configuration so duplicate schedules are stored once.

**Key files in this project:**
- `ARCHITECTURE.md` — Full design rationale, OEM paradigm analysis, physics model notes
- `maintenance_schedule_schema.sql` — Complete DDL with all tables, indexes, views, and seed data
- `gemini_response_contract.json` — Expected JSON format for Gemini schedule extraction responses

**Read ARCHITECTURE.md first.** It explains WHY every design decision was made, with real OEM examples from GM, Toyota, Honda (Maintenance Minder), Volvo, Mercedes (Flex Service), and Ram/Chrysler.

---

## Existing RO Engine Server Context

- PostgreSQL is already running on the RO Engine server
- The RO Engine app already has VIN decoding capability
- Gemini Flash API access is available for data extraction
- The maintenance schedule database is a NEW schema addition alongside existing RO Engine tables

---

## Implementation Phases

### Phase 1: Database Setup
**Task:** Execute the DDL to create all maintenance schedule tables.

1. Review `maintenance_schedule_schema.sql`
2. Create the tables in the RO Engine PostgreSQL instance
3. The DDL includes seed data for:
   - 16 maintenance item categories
   - ~60 common maintenance items with OEM name aliases
   - 12 validation rules for Gemini data sanity checking
4. Verify all tables, indexes, foreign keys, and views are created correctly

**Tables created (in dependency order):**
- `nhtsa_vehicle_taxonomy` (Layer 0 — staging)
- `powertrain_configs` (Layer 1)
- `fluid_specifications` (Layer 1b)
- `maintenance_item_categories` (Layer 2)
- `maintenance_items` (Layer 2)
- `maintenance_schedules` (Layer 3 — the core schedule data)
- `vehicle_applications` (Layer 4)
- `service_code_systems` (Layer 5)
- `service_code_definitions` (Layer 5)
- `service_code_items` (Layer 5)
- `service_kits` (Layer 6)
- `service_kit_items` (Layer 6)
- `gemini_ingestion_log` (Layer 7)
- `validation_rules` (Layer 7)

### Phase 2: NHTSA vPIC Database Download & Taxonomy Extraction
**Task:** Download the NHTSA vPIC PostgreSQL database and extract the vehicle taxonomy.

1. Download `vPICList_lite_2026_01.plain.zip` from https://vpic.nhtsa.dot.gov/Downloads
2. Restore into a separate `vpic_nhtsa` database (or `vpiclist_lite` schema in existing DB)
3. Explore the VIN pattern tables to understand their structure
4. Write extraction queries to pull unique year/make/model/engine combinations
5. Populate `nhtsa_vehicle_taxonomy` table with extracted data
6. Focus on 34 target consumer makes, years 2000-2026

**Alternative (if pattern table mining is complex):**
Use the NHTSA API to build the taxonomy:
- `GetModelsForMakeYear` for year/make/model list (~945 API calls)
- Then use Gemini to identify available engine options per model/year
- This is slower but avoids reverse-engineering VIN pattern tables

### Phase 3: Gemini Schedule Extraction Pipeline
**Task:** Build the pipeline that feeds vehicle configs to Gemini and writes results to the database.

1. Build a Gemini prompt template based on `gemini_response_contract.json`
2. For a given powertrain config, send prompt to Gemini Flash
3. Parse the JSON response
4. Run validation rules against extracted data (compare to `validation_rules` table)
5. Flag suspicious entries (`needs_review = TRUE`)
6. Write validated entries to `maintenance_schedules`
7. Log everything in `gemini_ingestion_log`
8. Handle deduplication: if powertrain config already exists, link vehicle application only

**Start with Volvo** — Joe knows the schedules from shop experience and can validate accuracy.

### Phase 4: Query/Lookup API
**Task:** Build the lookup function that takes a VIN and returns the full maintenance schedule.

1. VIN → NHTSA decode → year, make, model, engine code, drive type
2. Match to `powertrain_configs` using engine_code + transmission_type + drive_type
3. Pull all `maintenance_schedules` rows for that config
4. Given current mileage, calculate which items are due/overdue/upcoming
5. Return structured schedule with OEM intervals and AutoHouse recommended intervals
6. If no config match → trigger on-demand Gemini extraction (Phase 3 pipeline)

### Phase 5: AutoHouse Physics-Based Intervals (Future)
**Task:** Populate `ah_interval_*` fields using physics-based calculations.

This uses `fluid_specifications` and `powertrain_configs` physics parameters to compute adjusted intervals. See ARCHITECTURE.md Section 7 for the load factor model.

---

## Key Design Decisions (Don't Change These)

1. **Maintenance is stored per powertrain config, NOT per vehicle.** Multiple vehicles share configs.
2. **Intervals are stored as base repeating values**, not enumerated at every mileage point.
3. **Three-tier intervals:** OEM normal, OEM severe, AutoHouse recommended.
4. **14 interval expression types** are supported (see ARCHITECTURE.md Section 3).
5. **Service code systems** (Honda Maintenance Minder, Mercedes Flex Service) are first-class entities, not hacked into the fixed-interval model.
6. **OEM description text is stored verbatim** — it's what techs and service advisors need to see.
7. **Validation rules** are applied during Gemini ingestion to catch hallucinations.
8. **`data_confidence` and `needs_review`** fields exist for human-in-the-loop verification.

---

## Schema Quick Reference

### The Core Query Pattern
```sql
-- "What maintenance is due for this vehicle at this mileage?"
SELECT
    mi.name AS item,
    ms.action_type,
    ms.interval_miles,
    ms.interval_months,
    ms.ah_interval_miles,
    ms.oem_description,
    ms.requirement_level
FROM maintenance_schedules ms
JOIN maintenance_items mi ON ms.maintenance_item_id = mi.id
WHERE ms.powertrain_config_id = :config_id
  AND ms.interval_type = 'fixed_recurring'
  AND (:current_mileage % ms.interval_miles) < :threshold
ORDER BY ms.interval_miles;
```

### Matching VIN to Powertrain Config
```sql
-- After NHTSA VIN decode gives us engine_code, trans_type, drive_type:
SELECT id FROM powertrain_configs
WHERE engine_code = :decoded_engine_code
  AND drive_type = :decoded_drive_type
  -- transmission matching may need fuzzy logic
LIMIT 1;
```

### Checking What Needs Gemini Extraction
```sql
-- Powertrain configs that don't have schedules yet:
SELECT nt.make, nt.model, nt.year, nt.engine_code, nt.drive_type
FROM nhtsa_vehicle_taxonomy nt
WHERE nt.schedule_status = 'pending'
  AND nt.powertrain_config_id IS NULL
ORDER BY nt.make, nt.model, nt.year;
```

---

## Gemini Prompt Notes

- Use Gemini Flash for cost efficiency (high volume extraction)
- Prompt should request JSON output matching `gemini_response_contract.json`
- Include explicit instructions to distinguish between inspect/replace/check actions
- Ask for BOTH normal and severe service intervals
- Ask for equipment/option dependencies
- Ask for fluid specifications and capacities alongside schedules
- For Honda/Mercedes type vehicles, ask Gemini to describe the code system
- Always ask for OEM description verbatim text
- Two-pass strategy: extract first, then validate with a second prompt if confidence is low

---

## File Locations

These files should be placed in the RO Engine project directory alongside existing code.
Suggested path: `roengine/maintenance_schedule/`

```
roengine/maintenance_schedule/
├── ARCHITECTURE.md              # Design document (this conversation's output)
├── CLAUDE_CODE_GUIDE.md         # This file — implementation instructions
├── maintenance_schedule_schema.sql  # Full DDL
├── gemini_response_contract.json    # Gemini JSON schema
├── scripts/
│   ├── extract_nhtsa_taxonomy.py    # Phase 2: NHTSA data extraction
│   ├── gemini_extract_schedule.py   # Phase 3: Gemini pipeline
│   ├── validate_schedule_data.py    # Phase 3: Validation rules engine
│   └── lookup_schedule.py           # Phase 4: VIN → schedule lookup
└── tests/
    ├── test_volvo_s60_2017.py       # Validate against known Volvo data
    ├── test_honda_accord_2016.py    # Validate Honda Maintenance Minder handling
    └── test_deduplication.py        # Verify powertrain config deduplication
```

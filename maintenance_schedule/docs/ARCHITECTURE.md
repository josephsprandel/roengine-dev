# RO Engine: Universal Maintenance Schedule Database
## Architecture Design Document v1.0

---

## 1. Overview

A normalized maintenance schedule database that stores OEM maintenance requirements for all vehicle makes, models, and years. The database is designed around the principle that **maintenance is driven by powertrain configuration, not by model name**. A given engine/transmission/drivetrain combination that appears across multiple models and years stores its schedule data once.

Three tiers of interval data per entry:
- **OEM Normal** — manufacturer's standard interval
- **OEM Severe** — manufacturer's severe/special service interval
- **AutoHouse Recommended** — physics-based intervals calculated from powertrain load factors

---

## 2. OEM Schedule Paradigms Supported

The schema accommodates every maintenance schedule paradigm encountered across major OEMs:

| Paradigm | OEMs | How It Works |
|----------|------|-------------|
| **Fixed Interval** | GM, Toyota, Ram/Chrysler, older Volvo | Items at specific mileage/time intervals |
| **Algorithm-Driven** | Honda (Maintenance Minder) | Car's computer triggers service codes based on driving conditions |
| **Hybrid Code-Based** | Mercedes (Flex Service), BMW (CBS) | A/B services alternate at fixed intervals, numbered sub-services at independent intervals |
| **Conditional/Filtered** | All OEMs to varying degrees | Items filtered by engine code, transmission code, option codes, model year, equipment |

---

## 3. Interval Expression Types

Every pattern observed across OEM data:

| # | Type | Example | Schema Fields Used |
|---|------|---------|-------------------|
| 1 | Fixed recurring | Oil every 10k mi / 12 mo | `interval_miles`, `interval_months` |
| 2 | Fixed + explicit severe | Ball joints 15k normal, 5k severe | `interval_*` + `severe_interval_*` + `severe_use_conditions` |
| 3 | Fixed + vague severe | "More frequently in dusty conditions" | `interval_*` + `severe_condition_description` |
| 4 | Initial + recurring | Drive belt: first at 60k, then every 15k | `initial_miles/months` + `interval_miles/months` |
| 5 | One-time | Timing belt at 150k | `interval_type='one_time'` + `interval_miles` |
| 6 | Service code triggered | Honda sub-item 4 | `service_code_id` + `interval_type='service_code'` |
| 7 | Every Nth service | MB "Service 3 every service" | `interval_type='every_nth_service'` + `relative_multiplier` |
| 8 | Time-based only | MB brake fluid every 2 years | `interval_months` (no miles) |
| 9 | Conditional on use case | Diff fluid "only if towing" | `severe_use_only=TRUE` + `severe_use_conditions` |
| 10 | Equipment-dependent | "AWD models only", "CODE 487" | `requires_equipment`, `excludes_equipment` |
| 11 | Engine/trans code filter | MB air filter: 30k for eng 157, 50k for eng 278 | `applies_to_engine_codes`, `applies_to_trans_codes` |
| 12 | Model year dependent | MB trans service split at 2015/2016 | `applies_from_year`, `applies_to_year` |
| 13 | Relative to another item | Mini: plugs every 3rd oil change | `relative_item_id` + `relative_multiplier` |
| 14 | Algorithm with fallback | Honda: computer decides, 12-mo backstop | `interval_type='algorithm_driven'` + `fallback_interval_*` |

---

## 4. Table Relationships

```
powertrain_configs (1) ──── (N) maintenance_schedules
         │                            │
         │                            └──── maintenance_items (N:1)
         │                            │
         │                            └──── service_code_definitions (N:1, optional)
         │
         ├──── (N) vehicle_applications
         │
         ├──── (N) fluid_specifications
         │
         └──── (N) service_kits ──── (N) service_kit_items ──── maintenance_items

service_code_systems (1) ──── (N) service_code_definitions (1) ──── (N) service_code_items

gemini_ingestion_log ──── powertrain_configs (tracking only)
validation_rules (standalone, applied during ingestion)
```

---

## 5. Deduplication Strategy

### Problem
A 2018 Volvo S60 T5 FWD and a 2019 Volvo V60 T5 FWD share the same B4204T11 engine, Aisin TF-80SC transmission, and FWD drivetrain. Their maintenance schedules are identical.

### Solution
1. Gemini extracts schedule data for a specific year/make/model/engine
2. Ingestion pipeline computes a powertrain config hash from `(engine_code, transmission_code, drive_type)`
3. If the hash matches an existing config, mark `is_duplicate_config=TRUE` in the ingestion log
4. Create a new `vehicle_applications` row pointing to the existing `powertrain_configs` row
5. Skip schedule entry insertion (data already exists)
6. If the hash is new, create new `powertrain_configs` and `maintenance_schedules` rows

### Edge Case
Same engine code but different schedules across model years (Mercedes transmission service split at 2015/2016). These are handled by the `applies_from_year` / `applies_to_year` fields on `maintenance_schedules`, NOT by creating separate powertrain configs.

---

## 6. Gemini Data Collection Pipeline

### Prompt Strategy

**Phase 1: Vehicle + Powertrain Identification**
```
For a {year} {make} {model} with the {engine_code} engine:
Return the engine specifications, transmission details, and drivetrain configuration.
Include oil capacity, coolant capacity, and all fluid specifications with OEM part numbers.
Return as JSON matching the provided schema.
```

**Phase 2: Full Schedule Extraction**
```
For a {year} {make} {model} with the {engine_code} engine:
Return the complete OEM maintenance schedule including ALL items at ALL intervals.
For each item include: item name, action type, interval in miles AND months,
severe service interval if different, any equipment/condition requirements,
and the full OEM description text.
Distinguish between inspect, replace, check, lubricate, rotate, clean, reset, adjust actions.
If this vehicle uses a code-based system (Maintenance Minder, Flex Service, etc.),
describe the code system and what each code triggers.
Return as JSON matching the provided schema.
```

**Phase 3: Validation Pass**
```
Review the following maintenance schedule data for a {year} {make} {model}.
Flag any items where the interval seems incorrect, items that appear to be missing,
or items that contradict known OEM specifications.
{insert extracted data}
```

### Hallucination Prevention

1. **Sanity check rules** applied automatically (see `validation_rules` table)
2. **Cross-reference known data points** — compare against AllData screenshots or manual entries for vehicles AutoHouse services regularly (Volvos)
3. **Flag low-confidence extractions** — if Gemini expresses uncertainty, mark `data_confidence='low'`
4. **Human review queue** — any flagged entries go to review before loading
5. **Source citation** — prompt Gemini to cite which section of the owner's manual each item comes from

---

## 7. Physics-Based Interval Model (Future)

The `ah_interval_*` fields on `maintenance_schedules` will be populated by a load factor calculation:

### Oil Change Load Factor
```
load_factor = (hp_per_liter × avg_operating_rpm) / (oil_capacity_qt × oil_grade_factor)
```

### Observed Data Points

| Engine | HP/L | Oil Qt | Qt/HP | OEM Interval |
|--------|------|--------|-------|-------------|
| Volvo B4204T43 | 183.5 | 5.9 | 0.016 | 10,000 |
| Mercedes M278 | 95.5 | 8.5 | 0.019 | 10,000 |
| Honda J35Y1 | 79.4 | 4.5 | 0.016 | ~7,500-10,000 |
| Toyota 1GR-FE | 59.8 | 5.5 | 0.023 | 5,000-10,000 |
| Chevy LAF 2.4 | 75.8 | 4.7 | 0.026 | 7,500-10,000 |
| Ram 5.7 Hemi | 67.2 | 7.0 | 0.018 | 8,000-10,000 |

### Modifiers
- Forced induction: +thermal penalty (offset by synthetic oil requirement)
- Geographic: NW Arkansas summers (95-100°F average highs) = +heat penalty
- Driving pattern: inferred from mileage accumulation rate per customer
- Oil grade: synthetic = 2x thermal tolerance factor vs conventional

### Application
The physics model outputs an adjusted interval. If it differs significantly from OEM:
- `ah_interval_miles` is set to the physics-calculated value
- `ah_recommendation_notes` explains the reasoning
- RO Engine displays both OEM and AutoHouse recommended intervals to the customer

---

## 8. Service Kit Integration

### Problem
OEMs list timing belt, tensioner, idler pulley, and water pump as separate items. Shops sell and perform them as a kit.

### Solution
The `service_kits` table groups related items. When RO Engine generates a recommendation:
1. Check if the due item belongs to a service kit
2. If yes, recommend the full kit with combined pricing
3. Mark optional kit items (e.g., water pump is optional but recommended with timing belt)

### Example
```
Kit: "Timing Belt Service" (Volvo B4204T43)
  - Timing Belt (required)
  - Timing Belt Tensioner (required)
  - Timing Belt Idler Pulley (required)
  - Drive Belt (required)
  - Drive Belt Tensioner (required)
  - Water Pump (optional - recommended)
```

---

## 9. Vehicle Taxonomy Source: NHTSA vPIC Database

### Overview
The NHTSA Product Information Catalog (vPIC) provides a free, government-sourced, PostgreSQL-compatible database containing every vehicle sold in the US since 1981. This is our primary source for the complete year/make/model/engine taxonomy that tells us what to ask Gemini about.

### Database Setup
1. Download `vPICList_lite_2026_01.plain.zip` (~71 MB) from https://vpic.nhtsa.dot.gov/Downloads
2. Restore to RO Engine PostgreSQL server:
   ```bash
   psql --host localhost --port 5432 --username roengine --dbname vpic_nhtsa \
        --file vPICList_lite_2026_01.plain
   ```
3. The database restores into a `vpiclist_lite` schema

### Taxonomy Extraction Strategy
The vPIC database is structured around VIN patterns, not a browsable vehicle hierarchy. However, the internal pattern tables map VIN positions to engine codes, displacement, transmission, and drivetrain. We reverse-engineer the complete taxonomy by querying these pattern tables.

**Step 1: Extract all year/make/model combinations**
The NHTSA API provides this directly (no database needed):
```
GET /api/vehicles/GetModelsForMakeYear/make/{make}/modelyear/{year}/vehicletype/passenger%20car
```
Loop across ~35 target makes × ~27 years (2000-2026) = ~945 API calls.
Rate-limited at ~3/sec = ~5 minutes for the full taxonomy.

**Step 2: Extract engine options per model/year from VIN pattern tables**
Query the restored vPIC database to find all unique engine configurations per make/model/year.
The VIN pattern tables contain mappings from VIN character positions to:
- Engine code (e.g., B4204T43)
- Displacement
- Cylinder count
- Fuel type
- Turbo/supercharger
- Horsepower
- Drive type
- Transmission type

This gives us every possible powertrain configuration for every vehicle — the exact input list for Gemini schedule extraction.

**Step 3: Populate `powertrain_configs` and `vehicle_applications`**
Map the NHTSA-extracted data into our schema. Multiple year/model combos sharing the same engine/trans/drive → single `powertrain_configs` row with multiple `vehicle_applications` pointing to it.

### API Endpoints Used (Free, No Key Required)
| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `GetAllMakes` | Master make list | Low volume |
| `GetModelsForMakeYear` | Models per make/year | ~945 calls total |
| `DecodeVin` | VIN decode at check-in | Per-vehicle, on demand |
| Standalone DB queries | Engine options per model | Local, unlimited |

### Target Makes (34 consumer brands)
Acura, Alfa Romeo, Audi, BMW, Buick, Cadillac, Chevrolet, Chrysler, Dodge, Fiat, Ford, Genesis, GMC, Honda, Hyundai, Infiniti, Jaguar, Jeep, Kia, Land Rover, Lexus, Lincoln, Mazda, Mercedes-Benz, Mini, Mitsubishi, Nissan, Polestar, Porsche, Ram, Subaru, Tesla, Toyota, Volkswagen, Volvo

### Estimated Taxonomy Size
- ~35 makes × ~27 years × ~8 models avg × ~3 engine options avg = **~22,000 unique vehicle applications**
- Collapsing to unique powertrain configs: estimated **~4,000-6,000 unique configs**
- These 4,000-6,000 configs are what Gemini needs to extract schedules for

### VIN Decode at Check-In (Runtime)
When a VIN is entered in RO Engine:
1. Decode via NHTSA API → year, make, model, engine code, displacement, HP, drive type
2. Match to existing `powertrain_configs` row
3. If match found → pull full maintenance schedule instantly
4. If no match → queue for Gemini on-demand extraction, write results to DB

---

## 10. Data Collection Priority

### Phase 1: Volvo (AutoHouse core business)
All SPA platform engines (T5, T6, B5, B6, Polestar) across S60, V60, XC60, S90, V90, XC90.
Older P2/P3 platform (S60, V70, XC70, XC90) with the common 5-cylinder and 6-cylinder engines.

### Phase 2: Common AutoHouse customer vehicles
Toyota, Honda, Subaru — the vehicles that roll through the shop most often after Volvos.

### Phase 3: Full coverage expansion
All major makes: GM, Ford, Chrysler/Ram/Jeep, Nissan, Hyundai/Kia, BMW, Mercedes, Audi/VW.

### Phase 4: Commercial launch dataset
Target: 90%+ coverage of vehicles on US roads (roughly top 200 year/make/model/engine combinations cover the vast majority).

---

## 11. Open Questions

1. **EV/PHEV maintenance** — Volvos are going hybrid/electric. Need to account for battery conditioning, regen brake patterns, electric motor coolant, etc. Schema supports this but we need EV-specific maintenance items and categories.

2. **Mileage-based vs condition-based display** — When presenting to customers, do we show "due at 60,000 miles" or "due in approximately 10,000 miles based on your current odometer"? The latter requires knowing current mileage (available from RO history).

3. **AllData/Mitchell integration** — Can we pull structured data from AllData's API instead of relying entirely on Gemini extraction? Would provide a higher-confidence baseline for validation.

5. **NHTSA vPIC pattern table structure** — Need to explore the restored PostgreSQL database to understand exactly how VIN pattern tables map to engine options. The extraction query may need iteration once we see the actual table schema.

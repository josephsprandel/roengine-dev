-- ============================================================================
-- NHTSA vPIC Taxonomy Extraction Queries
-- ============================================================================
-- Extracts the complete year/make/model/engine taxonomy from the NHTSA vPIC
-- database and populates the nhtsa_vehicle_taxonomy table.
--
-- Data path:
--   wmi -> wmi_vinschema -> vinschema -> pattern -> element
--   pattern table (1.6M rows) is the core — each row maps a VIN character
--   pattern to a vehicle attribute (engine code, displacement, drive type, etc.)
--
-- Key discovery: Engine specs (element 18) and model/drive type (elements 28, 15)
-- live on DIFFERENT VIN pattern keys within the same VIN schema. This requires
-- splitting into engine_configs and model_configs tables, then cross-joining.
--
-- Additionally, ~60% of VIN schemas do NOT have element 18 (Engine Model) at all.
-- BMW, MINI, Chrysler/Dodge/Jeep/Ram, and many others encode engine info only
-- as cylinders + displacement + HP. For these, we build synthetic engine codes
-- like "I4 2.0L Turbo" from the available specs.
--
-- Strategy:
--   Pass 1: Extract schemas WITH element 18 (named engine codes like B4204TS)
--   Pass 2: Extract schemas WITHOUT element 18 (synthetic engine codes)
--   Cleanup: Remove non-consumer vehicles and cross-brand WMI contamination
--
-- Prerequisites:
--   - NHTSA vPIC database restored into vpic schema
--   - nhtsa_vehicle_taxonomy table created (see maintenance_schedule_schema.sql)
--   - Run this entire file in a single psql session (temp tables don't persist)
--
-- Usage:
--   PGPASSWORD=shopops_dev psql -h localhost -U shopops -d shopops3 -f nhtsa_extraction_queries.sql
-- ============================================================================


-- ============================================================================
-- PASS 1: Schemas with named engine codes (element 18)
-- Covers: Volvo, Honda, Toyota, Hyundai, Kia, Subaru, Audi, Mercedes-Benz (partial)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Build a reference of target consumer makes
-- The make table has 12,079 entries (trucks, trailers, etc.)
-- We only want the ~36 consumer passenger car brands
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE target_makes AS
SELECT DISTINCT m.id AS make_id, m.name AS make_name
FROM vpic.make m
WHERE UPPER(m.name) IN (
    'ACURA', 'ALFA ROMEO', 'AUDI', 'BMW', 'BUICK', 'CADILLAC',
    'CHEVROLET', 'CHRYSLER', 'DODGE', 'FIAT', 'FORD', 'GENESIS',
    'GMC', 'HONDA', 'HYUNDAI', 'INFINITI', 'JAGUAR', 'JEEP',
    'KIA', 'LAND ROVER', 'LEXUS', 'LINCOLN', 'MAZDA', 'MERCEDES-BENZ',
    'MINI', 'MITSUBISHI', 'NISSAN', 'POLESTAR', 'PORSCHE', 'RAM',
    'SCION', 'SUBARU', 'TESLA', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO'
);

\echo '=== Step 1: Target makes ==='
SELECT make_name, make_id FROM target_makes ORDER BY make_name;


-- ---------------------------------------------------------------------------
-- STEP 2: Find VIN schemas associated with target makes
-- Path: make -> wmi_make -> wmi -> wmi_vinschema -> vinschema
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE target_schemas AS
SELECT DISTINCT
    tm.make_name,
    tm.make_id,
    wvs.vinschemaid,
    wvs.yearfrom,
    wvs.yearto,
    w.wmi AS wmi_code
FROM target_makes tm
JOIN vpic.wmi_make wm ON wm.makeid = tm.make_id
JOIN vpic.wmi w ON w.id = wm.wmiid
JOIN vpic.wmi_vinschema wvs ON wvs.wmiid = w.id
WHERE COALESCE(wvs.yearfrom, 2000) <= 2026
  AND COALESCE(wvs.yearto, 2026) >= 2000;

\echo '=== Step 2: Schema coverage ==='
SELECT make_name, COUNT(DISTINCT vinschemaid) AS schema_count,
       MIN(yearfrom) AS earliest_year, MAX(yearto) AS latest_year
FROM target_schemas
GROUP BY make_name
ORDER BY make_name;


-- ---------------------------------------------------------------------------
-- STEP 3: Split-pivot the pattern table
-- Engine specs and model/drive info are on DIFFERENT keys within the same
-- VIN schema. We extract them separately, then cross-join.
--
-- Key element IDs:
--   9  = Engine Cylinders (direct int)
--   13 = Displacement in Liters (direct decimal)
--   15 = Drive Type (lookup: 1=FWD, 2=4WD, 3=AWD, 4=RWD)
--   18 = Engine Model (direct string, e.g., "B4204TS")
--   24 = Fuel Type Primary (lookup: 1=Diesel, 2=Electric, 4=Gasoline)
--   28 = Model (lookup -> vpic.model.id)
--   37 = Transmission Style (lookup: 2=Auto, 3=Manual, 7=CVT, 14=DCT)
--   62 = Valve Train Design (lookup: 2=DOHC, 3=OHV, 4=SOHC)
--   63 = Transmission Speeds (direct int)
--   64 = Engine Configuration (lookup: 1=Inline, 2=V, 5=Boxer)
--   71 = Engine HP (direct decimal)
--   135 = Turbo (lookup: 1=Yes, 2=No)
-- ---------------------------------------------------------------------------

-- 3a: Engine configs — keys that carry engine data (element 18)
-- Note: element 18 attributeid IS the engine code string directly,
-- NOT a lookup ID. No need to join vpic.enginemodel.
CREATE TEMP TABLE pass1_engine_configs AS
SELECT
    p.vinschemaid,
    p.keys,
    LEFT(MAX(CASE WHEN p.elementid = 18 THEN p.attributeid END), 50) AS engine_model,
    MAX(CASE WHEN p.elementid = 13 THEN p.attributeid END) AS displacement_l,
    MAX(CASE WHEN p.elementid = 9  THEN p.attributeid END) AS cylinders,
    MAX(CASE WHEN p.elementid = 71 THEN p.attributeid END) AS horsepower,
    MAX(CASE WHEN p.elementid = 24 THEN p.attributeid END) AS fuel_type_id,
    MAX(CASE WHEN p.elementid = 64 THEN p.attributeid END) AS engine_config_id,
    MAX(CASE WHEN p.elementid = 62 THEN p.attributeid END) AS valve_train_id,
    MAX(CASE WHEN p.elementid = 135 THEN p.attributeid END) AS turbo_id
FROM vpic.pattern p
WHERE p.vinschemaid IN (SELECT DISTINCT vinschemaid FROM target_schemas)
  AND p.elementid IN (9, 13, 18, 24, 62, 64, 71, 135)
GROUP BY p.vinschemaid, p.keys
HAVING MAX(CASE WHEN p.elementid = 18 THEN p.attributeid END) IS NOT NULL;

\echo '=== Step 3a: Engine config rows (pass 1) ==='
SELECT COUNT(*) FROM pass1_engine_configs;

-- 3b: Model configs — keys that carry model and drivetrain data
CREATE TEMP TABLE pass1_model_configs AS
SELECT
    p.vinschemaid,
    p.keys,
    MAX(CASE WHEN p.elementid = 28 THEN p.attributeid END) AS model_attr_id,
    MAX(CASE WHEN p.elementid = 15 THEN p.attributeid END) AS drive_type_id,
    MAX(CASE WHEN p.elementid = 37 THEN p.attributeid END) AS trans_style_id,
    MAX(CASE WHEN p.elementid = 63 THEN p.attributeid END) AS trans_speeds
FROM vpic.pattern p
WHERE p.vinschemaid IN (SELECT DISTINCT vinschemaid FROM target_schemas)
  AND p.elementid IN (15, 28, 37, 63)
GROUP BY p.vinschemaid, p.keys
HAVING MAX(CASE WHEN p.elementid = 28 THEN p.attributeid END) IS NOT NULL;

\echo '=== Step 3b: Model config rows (pass 1) ==='
SELECT COUNT(*) FROM pass1_model_configs;


-- ---------------------------------------------------------------------------
-- STEP 4: Cross-join engine and model configs, resolve lookups
-- Inline CASE statements for lookup resolution (vpic.lookupattribute
-- table does NOT exist in the vPIC database)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE pass1_resolved AS
SELECT DISTINCT
    ts.make_name,
    LEFT(COALESCE(mo.name, ''), 100) AS model_name,
    ts.yearfrom,
    ts.yearto,
    ts.wmi_code,
    ec.engine_model,
    CAST(NULLIF(ec.displacement_l, '') AS DECIMAL(3,1)) AS displacement_liters,
    CAST(NULLIF(ec.cylinders, '') AS INTEGER) AS cylinder_count,
    -- HP values come as decimals ("367.00") — round then cast to smallint
    ROUND(CAST(NULLIF(ec.horsepower, '') AS DECIMAL))::SMALLINT AS horsepower,
    CASE COALESCE(mc.drive_type_id, '')
        WHEN '1' THEN 'fwd'
        WHEN '2' THEN '4wd'
        WHEN '3' THEN 'awd'
        WHEN '4' THEN 'rwd'
        ELSE NULL
    END AS drive_type,
    CASE ec.fuel_type_id
        WHEN '1' THEN 'diesel'
        WHEN '2' THEN 'electric'
        WHEN '4' THEN 'gasoline'
        ELSE LEFT(ec.fuel_type_id, 20)
    END AS fuel_type,
    CASE COALESCE(mc.trans_style_id, '')
        WHEN '2' THEN 'automatic'
        WHEN '3' THEN 'manual'
        WHEN '7' THEN 'cvt'
        WHEN '14' THEN 'dct'
        ELSE NULL
    END AS transmission_type,
    CAST(NULLIF(COALESCE(mc.trans_speeds, ''), '') AS INTEGER) AS transmission_speeds,
    CASE ec.turbo_id WHEN '1' THEN 'yes' WHEN '2' THEN 'no' ELSE NULL END AS is_turbo,
    CASE ec.valve_train_id
        WHEN '2' THEN 'dohc' WHEN '3' THEN 'ohv' WHEN '4' THEN 'sohc'
        ELSE ec.valve_train_id
    END AS valve_train,
    CASE ec.engine_config_id
        WHEN '1' THEN 'inline' WHEN '2' THEN 'v' WHEN '5' THEN 'flat'
        ELSE ec.engine_config_id
    END AS engine_config,
    ec.vinschemaid,
    ec.keys AS vin_pattern_keys
FROM pass1_engine_configs ec
JOIN target_schemas ts ON ts.vinschemaid = ec.vinschemaid
LEFT JOIN pass1_model_configs mc ON mc.vinschemaid = ec.vinschemaid
LEFT JOIN vpic.make_model mm ON mm.makeid = ts.make_id
LEFT JOIN vpic.model mo ON mo.id = CAST(mc.model_attr_id AS INTEGER);

\echo '=== Step 4: Pass 1 resolved rows ==='
SELECT COUNT(*) FROM pass1_resolved;


-- ---------------------------------------------------------------------------
-- STEP 5: Expand year ranges and insert (Pass 1)
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE year_series AS
SELECT generate_series(2000, 2026) AS year;

\echo '=== Step 5: Inserting Pass 1 data ==='
INSERT INTO nhtsa_vehicle_taxonomy (
    make, model, year, engine_code, displacement_liters, cylinder_count,
    fuel_type, forced_induction, horsepower, transmission_type, drive_type,
    vin_pattern, vehicle_type, body_class, schedule_status
)
SELECT DISTINCT
    r.make_name,
    r.model_name,
    ys.year,
    r.engine_model,
    r.displacement_liters,
    r.cylinder_count::SMALLINT,
    r.fuel_type,
    CASE WHEN r.is_turbo = 'yes' THEN 'turbo' ELSE 'na' END,
    r.horsepower,
    r.transmission_type,
    r.drive_type,
    LEFT(r.wmi_code || ':' || r.vin_pattern_keys, 50),
    'PASSENGER CAR',
    NULL,
    'pending'
FROM pass1_resolved r
CROSS JOIN year_series ys
WHERE ys.year >= COALESCE(r.yearfrom, 2000)
  AND ys.year <= COALESCE(r.yearto, 2026)
  AND r.model_name != ''
  AND r.engine_model IS NOT NULL
ON CONFLICT DO NOTHING;

\echo '=== Pass 1 complete ==='
SELECT COUNT(*) AS pass1_total FROM nhtsa_vehicle_taxonomy;


-- ============================================================================
-- PASS 2: Schemas WITHOUT element 18 (named engine codes)
-- Covers: BMW, MINI, Chrysler, Dodge, Jeep, Ram, Fiat, Porsche, and
-- additional schemas for Ford, VW, Nissan, etc.
-- Builds synthetic engine codes from: config + cylinders + displacement + turbo
-- e.g., "I4 2.0L Turbo", "V6 3.5L", "V8 5.0L"
-- ============================================================================

\echo '=== Starting Pass 2: Schemas without element 18 ==='

-- Schemas that lack element 18
CREATE TEMP TABLE pass2_target_schemas AS
SELECT DISTINCT
    m.name AS make_name,
    m.id AS make_id,
    wvs.vinschemaid,
    wvs.yearfrom,
    wvs.yearto,
    w.wmi AS wmi_code
FROM vpic.make m
JOIN vpic.wmi_make wm ON wm.makeid = m.id
JOIN vpic.wmi w ON w.id = wm.wmiid
JOIN vpic.wmi_vinschema wvs ON wvs.wmiid = w.id
WHERE UPPER(m.name) IN (
    'ACURA', 'ALFA ROMEO', 'AUDI', 'BMW', 'BUICK', 'CADILLAC',
    'CHEVROLET', 'CHRYSLER', 'DODGE', 'FIAT', 'FORD', 'GENESIS',
    'GMC', 'HONDA', 'HYUNDAI', 'INFINITI', 'JAGUAR', 'JEEP',
    'KIA', 'LAND ROVER', 'LEXUS', 'LINCOLN', 'MAZDA', 'MERCEDES-BENZ',
    'MINI', 'MITSUBISHI', 'NISSAN', 'POLESTAR', 'PORSCHE', 'RAM',
    'SCION', 'SUBARU', 'TESLA', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO'
)
  AND COALESCE(wvs.yearfrom, 2000) <= 2026
  AND COALESCE(wvs.yearto, 2026) >= 2000
  AND wvs.vinschemaid NOT IN (
      SELECT DISTINCT vinschemaid FROM vpic.pattern WHERE elementid = 18
  );

\echo '=== Pass 2 target schemas ==='
SELECT make_name, COUNT(DISTINCT vinschemaid) AS schemas
FROM pass2_target_schemas GROUP BY make_name ORDER BY schemas DESC;

-- Engine configs (displacement/cylinders/HP, no element 18)
CREATE TEMP TABLE pass2_engine_configs AS
SELECT
    p.vinschemaid,
    p.keys,
    MAX(CASE WHEN p.elementid = 13 THEN p.attributeid END) AS displacement_l,
    MAX(CASE WHEN p.elementid = 9  THEN p.attributeid END) AS cylinders,
    MAX(CASE WHEN p.elementid = 71 THEN p.attributeid END) AS horsepower,
    MAX(CASE WHEN p.elementid = 24 THEN p.attributeid END) AS fuel_type_id,
    MAX(CASE WHEN p.elementid = 64 THEN p.attributeid END) AS engine_config_id,
    MAX(CASE WHEN p.elementid = 135 THEN p.attributeid END) AS turbo_id,
    MAX(CASE WHEN p.elementid = 62 THEN p.attributeid END) AS valve_train_id
FROM vpic.pattern p
WHERE p.vinschemaid IN (SELECT DISTINCT vinschemaid FROM pass2_target_schemas)
  AND p.elementid IN (9, 13, 24, 62, 64, 71, 135)
GROUP BY p.vinschemaid, p.keys
HAVING MAX(CASE WHEN p.elementid = 13 THEN p.attributeid END) IS NOT NULL
    OR MAX(CASE WHEN p.elementid = 9 THEN p.attributeid END) IS NOT NULL;

-- Model configs
CREATE TEMP TABLE pass2_model_configs AS
SELECT
    p.vinschemaid,
    p.keys,
    MAX(CASE WHEN p.elementid = 28 THEN p.attributeid END) AS model_attr_id,
    MAX(CASE WHEN p.elementid = 15 THEN p.attributeid END) AS drive_type_id,
    MAX(CASE WHEN p.elementid = 37 THEN p.attributeid END) AS trans_style_id,
    MAX(CASE WHEN p.elementid = 63 THEN p.attributeid END) AS trans_speeds
FROM vpic.pattern p
WHERE p.vinschemaid IN (SELECT DISTINCT vinschemaid FROM pass2_target_schemas)
  AND p.elementid IN (28, 15, 37, 63)
GROUP BY p.vinschemaid, p.keys
HAVING MAX(CASE WHEN p.elementid = 28 THEN p.attributeid END) IS NOT NULL;

-- Resolve with synthetic engine codes
CREATE TEMP TABLE pass2_resolved AS
SELECT DISTINCT
    ts.make_name,
    LEFT(COALESCE(mo.name, ''), 100) AS model_name,
    ts.yearfrom,
    ts.yearto,
    ts.wmi_code,
    -- Synthetic engine code: config_letter + cylinders + displacement + turbo
    -- e.g., "I4 2.0L Turbo", "V6 3.5L", "V8 5.0L"
    LEFT(
        COALESCE(
            CASE ec.engine_config_id
                WHEN '1' THEN 'I'
                WHEN '2' THEN 'V'
                WHEN '5' THEN 'F'
                WHEN '3' THEN 'W'
                WHEN '6' THEN 'R'
                ELSE ''
            END, ''
        ) ||
        COALESCE(NULLIF(ec.cylinders, ''), '') ||
        CASE WHEN ec.displacement_l IS NOT NULL AND ec.displacement_l != ''
             THEN ' ' || CAST(ROUND(CAST(ec.displacement_l AS DECIMAL), 1) AS TEXT) || 'L'
             ELSE ''
        END ||
        CASE WHEN ec.turbo_id = '1' THEN ' Turbo' ELSE '' END,
    50) AS engine_code,
    CAST(NULLIF(ec.displacement_l, '') AS DECIMAL(3,1)) AS displacement_liters,
    CAST(NULLIF(ec.cylinders, '') AS INTEGER) AS cylinder_count,
    ROUND(CAST(NULLIF(ec.horsepower, '') AS DECIMAL))::SMALLINT AS horsepower,
    CASE COALESCE(mc.drive_type_id, '')
        WHEN '1' THEN 'fwd'
        WHEN '2' THEN '4wd'
        WHEN '3' THEN 'awd'
        WHEN '4' THEN 'rwd'
        ELSE NULL
    END AS drive_type,
    CASE ec.fuel_type_id
        WHEN '1' THEN 'diesel'
        WHEN '2' THEN 'electric'
        WHEN '4' THEN 'gasoline'
        ELSE LEFT(ec.fuel_type_id, 20)
    END AS fuel_type,
    CASE COALESCE(mc.trans_style_id, '')
        WHEN '2' THEN 'automatic'
        WHEN '3' THEN 'manual'
        WHEN '7' THEN 'cvt'
        WHEN '14' THEN 'dct'
        ELSE NULL
    END AS transmission_type,
    CAST(NULLIF(COALESCE(mc.trans_speeds, ''), '') AS INTEGER) AS transmission_speeds,
    CASE ec.turbo_id WHEN '1' THEN 'yes' WHEN '2' THEN 'no' ELSE NULL END AS is_turbo,
    CASE ec.valve_train_id
        WHEN '2' THEN 'dohc' WHEN '3' THEN 'ohv' WHEN '4' THEN 'sohc'
        ELSE ec.valve_train_id
    END AS valve_train,
    CASE ec.engine_config_id
        WHEN '1' THEN 'inline' WHEN '2' THEN 'v' WHEN '5' THEN 'flat'
        ELSE ec.engine_config_id
    END AS engine_config,
    ec.vinschemaid,
    ec.keys AS vin_pattern_keys
FROM pass2_engine_configs ec
JOIN pass2_target_schemas ts ON ts.vinschemaid = ec.vinschemaid
LEFT JOIN pass2_model_configs mc ON mc.vinschemaid = ec.vinschemaid
LEFT JOIN vpic.make_model mm ON mm.makeid = ts.make_id
LEFT JOIN vpic.model mo ON mo.id = CAST(mc.model_attr_id AS INTEGER);

\echo '=== Pass 2 resolved rows ==='
SELECT COUNT(*) FROM pass2_resolved;

-- Insert pass 2 with consumer model whitelist for heavily contaminated makes
CREATE TEMP TABLE consumer_models (make_name VARCHAR(50), model_name VARCHAR(100));
INSERT INTO consumer_models VALUES
-- BMW
('BMW','1 Series'),('BMW','2 Series'),('BMW','3 Series'),('BMW','4 Series'),('BMW','5 Series'),
('BMW','6 Series'),('BMW','7 Series'),('BMW','8 Series'),('BMW','X1'),('BMW','X2'),
('BMW','X3'),('BMW','X4'),('BMW','X5'),('BMW','X6'),('BMW','X7'),('BMW','XM'),
('BMW','Z3'),('BMW','Z4'),('BMW','Z8'),('BMW','i3'),('BMW','i4'),('BMW','i5'),
('BMW','i7'),('BMW','i8'),('BMW','iX'),('BMW','iX1'),('BMW','iX3'),('BMW','M2'),
('BMW','M3'),('BMW','M4'),('BMW','M5'),('BMW','M6'),('BMW','M8'),
-- MINI
('MINI','Cooper'),('MINI','Countryman'),('MINI','Clubman'),('MINI','Paceman'),
('MINI','Coupe'),('MINI','Roadster'),('MINI','Convertible'),
('MINI','Cooper Hardtop'),('MINI','Cooper Clubman'),('MINI','Cooper Countryman'),
('MINI','Hardtop'),('MINI','Hardtop 2 Door'),('MINI','Hardtop 4 Door'),
-- Chrysler
('Chrysler','200'),('Chrysler','300'),('Chrysler','300C'),('Chrysler','300M'),
('Chrysler','Aspen'),('Chrysler','Concorde'),('Chrysler','Crossfire'),
('Chrysler','LHS'),('Chrysler','Pacifica'),('Chrysler','PT Cruiser'),
('Chrysler','Sebring'),('Chrysler','Town & Country'),('Chrysler','Town and Country'),
('Chrysler','Voyager'),
-- Dodge
('Dodge','Avenger'),('Dodge','Caliber'),('Dodge','Challenger'),('Dodge','Charger'),
('Dodge','Dakota'),('Dodge','Dart'),('Dodge','Durango'),('Dodge','Grand Caravan'),
('Dodge','Hornet'),('Dodge','Journey'),('Dodge','Magnum'),('Dodge','Neon'),
('Dodge','Nitro'),('Dodge','Ram 1500'),('Dodge','Ram 2500'),('Dodge','Ram 3500'),
('Dodge','Sprinter'),('Dodge','Stratus'),('Dodge','Viper'),('Dodge','Caravan'),
-- Jeep
('Jeep','Cherokee'),('Jeep','Compass'),('Jeep','Gladiator'),('Jeep','Grand Cherokee'),
('Jeep','Grand Cherokee L'),('Jeep','Grand Wagoneer'),('Jeep','Liberty'),
('Jeep','Patriot'),('Jeep','Renegade'),('Jeep','Wagoneer'),('Jeep','Wrangler'),
('Jeep','Wrangler JK'),('Jeep','Commander'),('Jeep','Wrangler Unlimited'),
-- Ram
('Ram','1500'),('Ram','2500'),('Ram','3500'),('Ram','ProMaster'),
('Ram','ProMaster City'),('Ram','1500 Classic'),
-- Fiat
('Fiat','500'),('Fiat','500e'),('Fiat','500L'),('Fiat','500X'),('Fiat','124 Spider'),
-- Porsche
('Porsche','911'),('Porsche','718 Boxster'),('Porsche','718 Cayman'),
('Porsche','Boxster'),('Porsche','Cayenne'),('Porsche','Cayman'),
('Porsche','Macan'),('Porsche','Panamera'),('Porsche','Taycan');

\echo '=== Inserting Pass 2 data ==='
INSERT INTO nhtsa_vehicle_taxonomy (
    make, model, year, engine_code, displacement_liters, cylinder_count,
    fuel_type, forced_induction, horsepower, transmission_type, drive_type,
    vin_pattern, vehicle_type, body_class, schedule_status
)
SELECT DISTINCT
    r.make_name,
    r.model_name,
    ys.year,
    r.engine_code,
    r.displacement_liters,
    r.cylinder_count::SMALLINT,
    r.fuel_type,
    CASE WHEN r.is_turbo = 'yes' THEN 'turbo' ELSE 'na' END,
    r.horsepower,
    r.transmission_type,
    r.drive_type,
    LEFT(r.wmi_code || ':' || r.vin_pattern_keys, 50),
    'PASSENGER CAR',
    NULL,
    'pending'
FROM pass2_resolved r
CROSS JOIN year_series ys
WHERE ys.year >= COALESCE(r.yearfrom, 2000)
  AND ys.year <= COALESCE(r.yearto, 2026)
  AND r.model_name != ''
  AND r.engine_code IS NOT NULL
  AND r.engine_code != ''
  -- Only include models in the consumer whitelist for contaminated makes
  AND (
    EXISTS (SELECT 1 FROM consumer_models cm
            WHERE cm.make_name = r.make_name AND cm.model_name = r.model_name)
    OR r.make_name NOT IN (
        'BMW', 'MINI', 'Chrysler', 'Dodge', 'Jeep', 'Ram', 'Fiat', 'Porsche', 'Scion'
    )
  )
ON CONFLICT DO NOTHING;

\echo '=== Pass 2 complete ==='
SELECT COUNT(*) AS after_pass2 FROM nhtsa_vehicle_taxonomy;


-- ============================================================================
-- CLEANUP: Remove non-consumer vehicles and cross-brand contamination
-- WMI codes are shared across makes within manufacturer groups (GM, Stellantis,
-- Toyota Motor Corp, Hyundai Motor Group, Renault-Nissan-Mitsubishi Alliance).
-- This causes model names to leak across brands.
-- Strategy: whitelist of known consumer models per contaminated make.
-- ============================================================================

\echo '=== Cleanup: Removing non-consumer vehicles ==='

BEGIN;

-- Volvo: Remove trucks, buses (ACL, VNL, VHD, B-series bus chassis, etc.)
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Volvo'
  AND model NOT IN (
    'S40', 'S60', 'S60 Cross Country', 'S70', 'S80', 'S90',
    'V40', 'V50', 'V60', 'V60CC', 'V70', 'V90', 'V90CC',
    'C30', 'C40', 'C70', 'C70 / C30',
    'XC40', 'XC60', 'XC70', 'XC90',
    'EX30', 'EX30 CC', 'EX40', 'EX90', 'EC40',
    'Polestar 1', 'Polestar 2'
  );

-- Honda: Remove motorcycles, ATVs, UTVs, scooters
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Honda'
  AND model NOT IN (
    'Accord', 'Accord Crosstour', 'Civic', 'Civic Si', 'Civic Type R',
    'Clarity', 'CR-V', 'CR-Z', 'Crosstour', 'Element',
    'FCX Clarity', 'Fit', 'HR-V', 'Insight', 'Jazz',
    'Odyssey', 'Passport', 'Pilot', 'Prelude', 'Prologue',
    'Ridgeline', 'S2000', 'ZR-V', 'ADX'
  );

-- Chevrolet: Remove medium/heavy commercial trucks + cross-brand models
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Chevrolet'
  AND model NOT IN (
    'Avalanche', 'Aveo', 'Blazer', 'Bolt Incomplete', 'BrightDrop',
    'Camaro', 'Captiva Sport', 'City Express', 'Colorado', 'Corvette',
    'Cruze', 'Equinox', 'Express', 'Impala',
    'Malibu', 'Matiz', 'Onix', 'Orlando',
    'Silverado', 'Silverado HD', 'Silverado LD', 'Silverado LTD',
    'Sonic', 'Spark', 'SS', 'Suburban', 'Suburban HD',
    'Tahoe', 'Tracker', 'Trailblazer', 'Traverse', 'Traverse Limited',
    'Trax', 'Volt', 'Zevo'
  );

-- GMC: Remove commercial vehicles
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'GMC'
  AND model NOT IN (
    'Acadia', 'Canyon', 'Hummer EV Pickup', 'Hummer EV SUV',
    'Savana', 'Sierra', 'Sierra HD', 'Sierra Limited',
    'Terrain', 'Yukon', 'Yukon XL'
  );

-- Ford: Remove commercial chassis, medium-duty trucks, cross-brand Lincoln
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Ford'
  AND model NOT IN (
    'Bronco', 'Bronco Sport', 'C-Max', 'Crown Victoria',
    'E-150', 'E-250', 'E-350', 'Edge', 'Escape',
    'Expedition', 'Expedition EL', 'Expedition MAX',
    'Explorer', 'Explorer Sport Trac',
    'F-150', 'F-250', 'F-350', 'F-450', 'F-550',
    'Fiesta', 'Flex', 'Focus', 'Fusion', 'GT',
    'Maverick', 'Mustang', 'Mustang GTD',
    'Ranger', 'Taurus', 'Transit', 'Transit Connect'
  );

-- Mercedes-Benz: Remove L-series commercial trucks
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Mercedes-Benz'
  AND model NOT IN (
    'A-Class', 'AMG GT', 'B-Class', 'C-Class', 'CLA-Class', 'CL-Class',
    'CLE', 'CLK-Class', 'CLS-Class', 'E-Class',
    'EQB-Class', 'EQE-Class Sedan', 'EQE-Class SUV',
    'EQS-Class Sedan', 'EQS-Class SUV', 'eSprinter',
    'G-Class', 'GLA-Class', 'GLB-Class', 'GLC-Class',
    'GL-Class', 'GLE-Class', 'GLK-Class', 'GLS-Class',
    'M-Class', 'Metris', 'S-Class', 'SLC-Class',
    'SL-Class', 'SLK-Class', 'SLS-Class', 'Sprinter'
  );

-- Toyota: Keep Toyota consumer models + Scion sub-brand
-- Remove cross-brand Lexus, Subaru, Mazda models from shared WMIs
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Toyota'
  AND model NOT IN (
    '4Runner', '86', 'Avalon', 'bZ4X',
    'Camry', 'Camry Solara', 'Celica', 'C-HR',
    'Corolla', 'Corolla Cross', 'COROLLA iM', 'Corolla Matrix',
    'Crown', 'Crown Signia', 'Echo',
    'FCHV-adv', 'FJ Cruiser', 'GR86', 'Grand Highlander', 'GR Corolla',
    'Highlander', 'Land Cruiser', 'Mirai', 'MR2', 'Paseo',
    'Prius', 'Prius C', 'Prius Prime (PHEV)', 'Prius V',
    'RAV4', 'RAV4 Prime (PHEV)', 'Sequoia', 'Sienna',
    'Tacoma', 'Tundra', 'Venza', 'Yaris', 'Yaris iA',
    'Scion FR-S', 'Scion iA', 'Scion iM', 'Scion iQ',
    'Scion tC', 'Scion xA', 'Scion xB', 'Scion xD'
  );

-- Nissan: Remove cross-brand Infiniti and Mitsubishi models
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Nissan'
  AND model NOT IN (
    '240SX', '350Z', '370Z', 'Altima', 'Altra-EV',
    'Ariya Hatchback', 'Ariya MPV', 'Armada', 'Frontier',
    'GT-R', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Nissan Z',
    'NV200', 'Pathfinder', 'Quest', 'Rogue', 'Rogue Sport',
    'Sentra', 'Titan', 'Versa', 'Versa Note', 'Xterra'
  );

-- Hyundai: Remove cross-brand Kia/Genesis models + Xcient truck
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Hyundai'
  AND model NOT IN (
    'Accent', 'Azera', 'Elantra', 'Elantra GT', 'Elantra N',
    'Elantra Touring', 'Entourage', 'Equus',
    'Genesis', 'Genesis Coupe', 'Ioniq',
    'Kona', 'Kona N', 'Palisade', 'Santa Cruz',
    'Santa Fe', 'Santa Fe Sport', 'Santa Fe XL',
    'Sonata', 'Tiburon', 'Tucson',
    'Veloster', 'Veloster N', 'Venue', 'Veracruz'
  );

-- Kia: Remove cross-brand Hyundai models
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Kia'
  AND model NOT IN (
    'Amanti', 'Borrego', 'Cadenza', 'Carnival', 'Forte', 'Forte Koup',
    'K4', 'K5', 'K900', 'Niro', 'Optima', 'Rio', 'Rondo',
    'Sedona', 'Seltos', 'Sorento', 'Soul', 'Spectra',
    'Sportage', 'Stinger', 'Telluride'
  );

-- Cadillac: Remove specialty vehicles and cross-brand GM models
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Cadillac'
  AND model NOT IN (
    'ATS', 'Celestiq', 'CT4', 'CT5', 'CT6', 'CTS', 'ELR',
    'Escalade', 'Escalade ESV', 'Escalade IQ', 'Escalade IQL',
    'Lyriq', 'Optiq', 'Vistiq', 'XT4', 'XT5', 'XT6', 'XTS'
  );

-- Volkswagen: Remove Stellantis contamination (Cherokee, Grand Caravan, etc.)
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Volkswagen'
  AND model NOT IN (
    'Arteon', 'Atlas', 'Atlas Cross Sport', 'Beetle', 'Cabrio',
    'CC', 'e-Golf', 'Eos', 'EuroVan', 'GLI',
    'Golf', 'Golf Alltrack', 'Golf GTI', 'Golf R', 'Golf SportWagen',
    'GTI', 'ID.4', 'ID.Buzz', 'Jetta', 'Jetta GLI', 'Jetta SportWagen', 'Jetta Wagon',
    'Passat', 'Phaeton', 'R32', 'Rabbit', 'Routan',
    'Taos', 'Tiguan', 'Tiguan Limited', 'Touareg'
  );

-- Infiniti: Remove cross-brand Nissan/Mitsubishi models
DELETE FROM nhtsa_vehicle_taxonomy
WHERE make = 'Infiniti'
  AND model NOT IN (
    'EX35', 'EX37', 'FX35', 'FX37', 'FX45', 'FX50',
    'G20', 'G25', 'G35', 'G37', 'I30', 'I35',
    'J30', 'JX35', 'M35', 'M37', 'M45', 'M56',
    'Q45', 'Q50', 'Q60', 'Q70', 'Q70L',
    'QX30', 'QX4', 'QX50', 'QX55', 'QX56', 'QX60', 'QX70', 'QX80'
  );

COMMIT;


-- ============================================================================
-- VERIFICATION: Report final state
-- ============================================================================

\echo '=== Final Results ==='

SELECT COUNT(*) AS total_entries FROM nhtsa_vehicle_taxonomy;

SELECT make, COUNT(*) AS entries
FROM nhtsa_vehicle_taxonomy
GROUP BY make
ORDER BY entries DESC;

SELECT COUNT(*) AS unique_powertrain_configs
FROM (
    SELECT DISTINCT engine_code, transmission_type, drive_type
    FROM nhtsa_vehicle_taxonomy
    WHERE engine_code IS NOT NULL
) sub;

-- Volvo consumer detail
SELECT year, model, engine_code, displacement_liters, cylinder_count,
       horsepower, drive_type, transmission_type, forced_induction
FROM nhtsa_vehicle_taxonomy
WHERE make = 'Volvo'
ORDER BY year, model, engine_code;

-- 2017 Volvo S60 spot check (should include B4204TS at 367hp, Polestar)
\echo '=== 2017 Volvo S60 spot check ==='
SELECT year, model, engine_code, displacement_liters, cylinder_count,
       horsepower, drive_type, forced_induction
FROM nhtsa_vehicle_taxonomy
WHERE make = 'Volvo' AND model = 'S60' AND year = 2017
ORDER BY engine_code;

-- Estimated Gemini API calls
\echo '=== Gemini extraction stats ==='
SELECT
    COUNT(DISTINCT engine_code || '|' || COALESCE(transmission_type,'') || '|' || COALESCE(drive_type,''))
    AS total_gemini_calls_needed
FROM nhtsa_vehicle_taxonomy;

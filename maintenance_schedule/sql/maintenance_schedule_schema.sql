-- ============================================================================
-- RO Engine: Universal Maintenance Schedule Database
-- ============================================================================
-- Designed to accommodate all OEM maintenance schedule paradigms:
--   - Fixed interval (GM, Toyota, Ram/Chrysler)
--   - Code-based / algorithm-driven (Honda Maintenance Minder)
--   - Hybrid service code + numbered sub-services (Mercedes Flex Service)
--   - Conditional/equipment-filtered (Volvo, Mercedes option codes)
--   - Physics-based AutoHouse recommended intervals
--
-- Architecture:
--   Layer 1: Powertrain configurations (deduplicated mechanical identity)
--   Layer 2: Maintenance items (universal catalog of serviceable components)
--   Layer 3: Maintenance schedules (the interval data, per powertrain config)
--   Layer 4: Vehicle applications (year/make/model -> powertrain config)
--   Layer 5: Service code systems (Honda, Mercedes, BMW code paradigms)
--   Layer 6: Service kits (grouped items done together in practice)
--   Layer 7: Fluid/capacity specifications (physics-based inputs)
-- ============================================================================

-- ============================================================================
-- LAYER 0: NHTSA VEHICLE TAXONOMY (staging/reference)
-- Extracted from the NHTSA vPIC downloadable database.
-- This is the master list of "what exists" — every year/make/model/engine
-- combination sold in the US. Used to drive Gemini data collection and
-- to match incoming VINs to powertrain configs.
-- ============================================================================

CREATE TABLE nhtsa_vehicle_taxonomy (
    id                      SERIAL PRIMARY KEY,

    -- Vehicle identification (from NHTSA)
    nhtsa_make_id           INTEGER,
    make                    VARCHAR(50) NOT NULL,
    nhtsa_model_id          INTEGER,
    model                   VARCHAR(100) NOT NULL,
    year                    SMALLINT NOT NULL,

    -- Engine details (from VIN pattern tables)
    engine_code             VARCHAR(50),
    displacement_liters     DECIMAL(3,1),
    cylinder_count          SMALLINT,
    fuel_type               VARCHAR(20),
    forced_induction        VARCHAR(20),                    -- na, turbo, supercharged, twin_turbo
    horsepower              SMALLINT,

    -- Transmission
    transmission_type       VARCHAR(20),                    -- automatic, manual, cvt

    -- Drivetrain
    drive_type              VARCHAR(10),                    -- fwd, rwd, awd, 4wd

    -- VIN pattern for matching
    vin_pattern             VARCHAR(20),                    -- VIN positions 1-8 that identify this config

    -- Vehicle type
    vehicle_type            VARCHAR(50),                    -- PASSENGER CAR, TRUCK, MPV, etc.
    body_class              VARCHAR(50),                    -- Sedan, SUV, Pickup, etc.

    -- Processing status
    powertrain_config_id    INTEGER REFERENCES powertrain_configs(id),  -- NULL until mapped
    schedule_status         VARCHAR(20) DEFAULT 'pending',  -- pending, queued, extracted, loaded, skipped

    created_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(make, model, year, engine_code, transmission_type, drive_type)
);

CREATE INDEX idx_taxonomy_make_model ON nhtsa_vehicle_taxonomy(make, model, year);
CREATE INDEX idx_taxonomy_engine ON nhtsa_vehicle_taxonomy(engine_code);
CREATE INDEX idx_taxonomy_status ON nhtsa_vehicle_taxonomy(schedule_status);
CREATE INDEX idx_taxonomy_vin_pattern ON nhtsa_vehicle_taxonomy(vin_pattern);


-- ============================================================================
-- LAYER 1: POWERTRAIN CONFIGURATIONS
-- The deduplicated core. A "powertrain config" is a unique mechanical
-- identity that determines maintenance requirements. Many vehicles share
-- the same config. Example: Volvo B4204T43 + Aisin TF-80SC + AWD is one
-- config used across S60, V60, XC60 for multiple model years.
-- ============================================================================

CREATE TABLE powertrain_configs (
    id                      SERIAL PRIMARY KEY,

    -- Engine identification
    engine_code             VARCHAR(50) NOT NULL,           -- OEM engine code: B4204T43, 1GR-FE, J35Y1, 278.927
    engine_family           VARCHAR(100),                   -- Marketing/common name: "Hemi", "EcoBoost", "B5"
    displacement_liters     DECIMAL(3,1) NOT NULL,          -- 2.0, 3.5, 4.7, 5.7
    cylinder_count          SMALLINT NOT NULL,              -- 4, 6, 8
    cylinder_layout         VARCHAR(10) NOT NULL,           -- inline, v, flat, rotary
    valve_train             VARCHAR(20),                    -- dohc, sohc, ohv (pushrod)

    -- Forced induction
    forced_induction_type   VARCHAR(20) DEFAULT 'na',       -- na, turbo, supercharged, twin_turbo, twin_charged

    -- Fuel
    fuel_type               VARCHAR(20) NOT NULL,           -- gasoline, diesel, hybrid, phev, bev, hydrogen

    -- Transmission identification
    transmission_code       VARCHAR(50),                    -- Aisin TF-80SC, 722.931, HCF-2 CVT
    transmission_type       VARCHAR(20) NOT NULL,           -- automatic, manual, cvt, dct, amt
    transmission_speeds     SMALLINT,                       -- 5, 6, 7, 8, 9, 10

    -- Drivetrain
    drive_type              VARCHAR(10) NOT NULL,           -- fwd, rwd, awd, 4wd

    -- Transfer case (4WD/AWD only)
    has_transfer_case       BOOLEAN DEFAULT FALSE,

    -- Physics parameters for load factor calculations
    horsepower              SMALLINT,
    torque_lb_ft            SMALLINT,
    redline_rpm             SMALLINT,
    compression_ratio       DECIMAL(4,2),

    -- Metadata
    oem_make                VARCHAR(50) NOT NULL,           -- Volvo, Toyota, Honda, Mercedes-Benz, Ram
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(engine_code, transmission_code, drive_type)
);

CREATE INDEX idx_powertrain_engine_code ON powertrain_configs(engine_code);
CREATE INDEX idx_powertrain_oem ON powertrain_configs(oem_make);


-- ============================================================================
-- LAYER 1b: FLUID AND CAPACITY SPECIFICATIONS
-- Tied to powertrain configs. Stores oil capacity, coolant capacity,
-- fluid specs, etc. These are inputs to physics-based interval calculations
-- and also useful for building RO estimates (parts/materials).
-- ============================================================================

CREATE TABLE fluid_specifications (
    id                      SERIAL PRIMARY KEY,
    powertrain_config_id    INTEGER NOT NULL REFERENCES powertrain_configs(id),

    -- Fluid identification
    fluid_type              VARCHAR(30) NOT NULL,           -- engine_oil, coolant, atf, manual_trans,
                                                            -- differential_front, differential_rear,
                                                            -- transfer_case, brake_fluid, power_steering,
                                                            -- cvt_fluid

    -- Capacity
    capacity_liters         DECIMAL(5,2),
    capacity_quarts         DECIMAL(5,2),
    capacity_note           VARCHAR(200),                   -- "with filter", "including reservoir", "drain and fill only"

    -- Specification
    fluid_spec              VARCHAR(100),                   -- VCC RBS0-2AE, MB 229.5, ATF DW-1, 0W-20
    fluid_spec_alt          VARCHAR(100),                   -- Alternate acceptable spec
    oem_part_number         VARCHAR(50),                    -- OEM fluid part number if specified

    -- Warnings
    fluid_warning           TEXT,                           -- "Using the wrong type of fluid will damage the transmission"

    created_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(powertrain_config_id, fluid_type)
);

CREATE INDEX idx_fluid_specs_powertrain ON fluid_specifications(powertrain_config_id);


-- ============================================================================
-- LAYER 2: MAINTENANCE ITEMS
-- Universal catalog of serviceable components/operations. These are
-- normalized across all OEMs. "Engine Oil" is one item regardless of
-- whether it appears in a GM schedule, Honda Maintenance Minder, or
-- Mercedes Flex Service.
-- ============================================================================

CREATE TABLE maintenance_item_categories (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(50) NOT NULL UNIQUE,    -- engine, transmission, brakes, steering_suspension,
                                                            -- electrical, body, tires_wheels, exhaust,
                                                            -- fuel_system, cooling, hvac, drivetrain,
                                                            -- safety, fluids, filters, ignition
    display_order           SMALLINT DEFAULT 0
);

CREATE TABLE maintenance_items (
    id                      SERIAL PRIMARY KEY,
    category_id             INTEGER NOT NULL REFERENCES maintenance_item_categories(id),

    -- Item identification
    name                    VARCHAR(100) NOT NULL,          -- Normalized name: "Engine Oil", "Spark Plugs", "Brake Pads"
    name_aliases            TEXT[],                         -- AllData/OEM alternate names: {"Oil Filter, Engine", "Engine Oil Filter"}

    -- Classification
    is_powertrain_dependent BOOLEAN DEFAULT TRUE,           -- TRUE = interval varies by powertrain config
                                                            -- FALSE = universal (wiper blades, cabin filter, etc.)

    is_emissions_related    BOOLEAN DEFAULT FALSE,          -- Federal emissions warranty implications

    -- For physics-based calculations
    wear_type               VARCHAR(20),                    -- fluid_degradation, mechanical_wear,
                                                            -- chemical_degradation, time_degradation,
                                                            -- condition_based

    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_maint_items_name ON maintenance_items(name);
CREATE INDEX idx_maint_items_category ON maintenance_items(category_id);


-- ============================================================================
-- LAYER 3: MAINTENANCE SCHEDULES
-- The core join: links a powertrain config to a maintenance item with
-- interval data. This is the table Gemini populates.
--
-- Each row represents ONE maintenance action for ONE item on ONE
-- powertrain config. A single component may have multiple rows
-- (e.g., "inspect brake pads every 10k" AND "replace brake pads every 60k").
--
-- Intervals are stored as base repeating values, NOT enumerated at every
-- mileage checkpoint. The system calculates which items are due at any
-- given mileage.
-- ============================================================================

CREATE TABLE maintenance_schedules (
    id                      SERIAL PRIMARY KEY,
    powertrain_config_id    INTEGER NOT NULL REFERENCES powertrain_configs(id),
    maintenance_item_id     INTEGER NOT NULL REFERENCES maintenance_items(id),

    -- ================================================================
    -- ACTION TYPE
    -- What kind of maintenance action this entry represents
    -- ================================================================
    action_type             VARCHAR(20) NOT NULL,           -- replace, inspect, check, lubricate, rotate,
                                                            -- clean, reset, adjust, tighten_torque,
                                                            -- diagnose_test, service_charge

    -- ================================================================
    -- INTERVAL TYPE
    -- How the interval is determined
    -- ================================================================
    interval_type           VARCHAR(30) NOT NULL,           -- fixed_recurring:     every X miles / Y months
                                                            -- one_time:            once at X miles, never again
                                                            -- initial_then_recurring: first at X, then every Y
                                                            -- service_code:        triggered by OEM service code
                                                            -- every_nth_service:   every Nth A/B service visit
                                                            -- relative_to_item:    every Nth occurrence of another item
                                                            -- algorithm_driven:    OEM computer decides, fallback interval
                                                            -- condition_based:     replace when inspection indicates need

    -- ================================================================
    -- NORMAL OPERATING INTERVALS
    -- "Whichever comes first" is the default logic
    -- ================================================================
    interval_miles          INTEGER,                        -- Normal: every X miles
    interval_months         INTEGER,                        -- Normal: every Y months

    -- ================================================================
    -- SEVERE / SPECIAL OPERATING INTERVALS
    -- Applied when vehicle matches severe_use_conditions
    -- ================================================================
    severe_interval_miles   INTEGER,                        -- Severe: every X miles
    severe_interval_months  INTEGER,                        -- Severe: every Y months
    severe_use_conditions   TEXT[],                         -- Enum set: {towing, off_road, dusty, extreme_heat,
                                                            --   extreme_cold, stop_and_go, mountainous, humid,
                                                            --   commercial_fleet, police_taxi, urban_soot,
                                                            --   low_speed}
    severe_condition_description TEXT,                      -- OEM verbatim: "driving in mountainous areas or humid climates"

    -- ================================================================
    -- AUTOHOUSE RECOMMENDED INTERVALS
    -- Physics-based overrides. This is the secret sauce.
    -- NULL means "use OEM interval" (no override)
    -- ================================================================
    ah_interval_miles       INTEGER,
    ah_interval_months      INTEGER,
    ah_severe_interval_miles    INTEGER,
    ah_severe_interval_months   INTEGER,
    ah_recommendation_notes TEXT,                           -- Explanation: "OEM says lifetime fluid but this trans fails at 120k without service"

    -- ================================================================
    -- INITIAL + RECURRING PATTERN
    -- For items like "first inspect at 60k, then every 15k thereafter"
    -- When interval_type = 'initial_then_recurring':
    --   initial_* = first occurrence, interval_* = subsequent recurrence
    -- ================================================================
    initial_miles           INTEGER,
    initial_months          INTEGER,

    -- ================================================================
    -- RELATIVE / NTH-SERVICE PATTERN
    -- For "every 3rd oil change" or "Service 3 every service"
    -- ================================================================
    relative_item_id        INTEGER REFERENCES maintenance_items(id),   -- The item this is relative to
    relative_multiplier     SMALLINT,                       -- "every Nth" — the N

    -- ================================================================
    -- ALGORITHM-DRIVEN FALLBACK
    -- For Honda Maintenance Minder, etc. The algorithm decides, but
    -- there's a backstop if the display doesn't trigger.
    -- ================================================================
    fallback_interval_miles     INTEGER,
    fallback_interval_months    INTEGER,

    -- ================================================================
    -- CONDITIONAL REPLACEMENT TRIGGER
    -- For inspect items that embed a "replace if needed" condition
    -- e.g., "Inspect air filter, replace if dirty"
    -- ================================================================
    has_conditional_replacement BOOLEAN DEFAULT FALSE,
    conditional_replacement_note TEXT,                      -- "Replace if filter remains covered with dirt after shaking"

    -- ================================================================
    -- APPLICABILITY FILTERS
    -- Not every item applies to every vehicle on a given powertrain config
    -- ================================================================
    requires_equipment      TEXT[],                         -- OEM option/equipment codes: {"sunroof", "awd", "CODE_487", "CODE_889"}
    excludes_equipment      TEXT[],                         -- Items that make this NOT apply
    applies_to_engine_codes TEXT[],                         -- Mercedes: specific engine codes within a platform {157, 279}
    applies_to_trans_codes  TEXT[],                         -- Mercedes: specific transmission codes {722.931}
    applies_from_year       SMALLINT,                       -- Model year range start (inclusive)
    applies_to_year         SMALLINT,                       -- Model year range end (inclusive)
    severe_use_only         BOOLEAN DEFAULT FALSE,          -- Only applies under severe/special conditions

    -- ================================================================
    -- SERVICE PRIORITY / REQUIREMENT LEVEL
    -- ================================================================
    requirement_level       VARCHAR(20) DEFAULT 'required', -- required, required_additional, recommended
    warranty_class          VARCHAR(5),                     -- S = service, E = emission, B = both, NULL = none

    -- ================================================================
    -- OEM DESCRIPTION AND PROCEDURE REFERENCES
    -- The full OEM text — valuable for tech-facing display
    -- ================================================================
    oem_description         TEXT,                           -- Verbatim OEM maintenance instruction text
    oem_procedure_code      VARCHAR(50),                    -- Mercedes AP codes, AllData operation IDs

    -- ================================================================
    -- SERVICE CODE REFERENCE
    -- For code-based systems (Honda, Mercedes)
    -- ================================================================
    service_code_id         INTEGER,                        -- FK to service_code_definitions (added after that table)

    -- ================================================================
    -- DATA PROVENANCE
    -- ================================================================
    data_source             VARCHAR(50),                    -- alldata, oem_manual, gemini_extracted, autohouse_manual
    data_confidence         VARCHAR(10) DEFAULT 'verified', -- verified, high, medium, low, flagged
    needs_review            BOOLEAN DEFAULT FALSE,
    review_notes            TEXT,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sched_powertrain ON maintenance_schedules(powertrain_config_id);
CREATE INDEX idx_sched_item ON maintenance_schedules(maintenance_item_id);
CREATE INDEX idx_sched_action ON maintenance_schedules(action_type);
CREATE INDEX idx_sched_interval_type ON maintenance_schedules(interval_type);
CREATE INDEX idx_sched_needs_review ON maintenance_schedules(needs_review) WHERE needs_review = TRUE;


-- ============================================================================
-- LAYER 4: VEHICLE APPLICATIONS
-- The many-to-one mapping from year/make/model/trim to powertrain config.
-- This is where all the "duplicates" collapse. 15 Volvo models might
-- point to 3-4 powertrain configs.
-- ============================================================================

CREATE TABLE vehicle_applications (
    id                      SERIAL PRIMARY KEY,
    powertrain_config_id    INTEGER NOT NULL REFERENCES powertrain_configs(id),

    -- Vehicle identification
    make                    VARCHAR(50) NOT NULL,           -- Volvo, Toyota, Honda
    model                   VARCHAR(100) NOT NULL,          -- S60, FJ Cruiser, Accord
    submodel                VARCHAR(100),                   -- Polestar, TRD, Sport
    body_style              VARCHAR(50),                    -- sedan, coupe, suv, truck, van, wagon, convertible

    -- Year range this application covers
    year_start              SMALLINT NOT NULL,              -- First model year with this config
    year_end                SMALLINT NOT NULL,              -- Last model year with this config

    -- Market
    market                  VARCHAR(10) DEFAULT 'us',       -- us, eu, global

    -- OEM model/platform codes
    oem_platform_code       VARCHAR(30),                    -- Mercedes 231, Volvo SPA, Toyota J200
    oem_model_code          VARCHAR(30),                    -- 231.473 (Mercedes), etc.

    -- VIN pattern for automated matching
    vin_pattern             VARCHAR(20),                    -- VIN positions 1-8 pattern for this application

    -- OEM service schedule identifier
    oem_schedule_name       VARCHAR(100),                   -- "Condition/Indicator Based" (Honda), "Flex Service" (MB)

    -- Maintenance schedule paradigm for this vehicle
    schedule_paradigm       VARCHAR(30) NOT NULL,           -- fixed_interval, algorithm_driven, hybrid_code_based

    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vehicle_app_powertrain ON vehicle_applications(powertrain_config_id);
CREATE INDEX idx_vehicle_app_make_model ON vehicle_applications(make, model);
CREATE INDEX idx_vehicle_app_years ON vehicle_applications(year_start, year_end);
CREATE INDEX idx_vehicle_app_vin ON vehicle_applications(vin_pattern);


-- ============================================================================
-- LAYER 5: SERVICE CODE SYSTEMS
-- For Honda Maintenance Minder, Mercedes Flex Service, BMW CBS, etc.
-- Maps OEM service codes to the maintenance items they trigger.
-- ============================================================================

CREATE TABLE service_code_systems (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(100) NOT NULL,          -- "Honda Maintenance Minder", "Mercedes Flex Service"
    oem_make                VARCHAR(50) NOT NULL,           -- Honda, Mercedes-Benz, BMW
    description             TEXT,

    -- How the system determines when services are due
    trigger_method          VARCHAR(30) NOT NULL,           -- algorithm (Honda), mileage_alternating (Mercedes A/B),
                                                            -- sensor_based (BMW CBS)

    -- Base service interval (for systems that alternate like Mercedes A/B)
    base_interval_miles     INTEGER,                        -- Mercedes: 10,000 (A and B alternate)
    base_interval_months    INTEGER,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_code_definitions (
    id                      SERIAL PRIMARY KEY,
    system_id               INTEGER NOT NULL REFERENCES service_code_systems(id),

    -- Code identification
    code                    VARCHAR(20) NOT NULL,           -- A, B, 1, 2, 3, 4, 5 (Honda)
                                                            -- Service_A, Service_B, Service_3, Service_4 (Mercedes)
    code_display            VARCHAR(50),                    -- Human-readable: "Service A", "Sub Item 4"

    -- Code behavior
    code_type               VARCHAR(20) NOT NULL,           -- primary (Honda A/B, Mercedes A/B)
                                                            -- sub_item (Honda 1-5)
                                                            -- numbered_service (Mercedes Service 3, 4, 8, etc.)

    -- For numbered services with their own intervals (Mercedes)
    service_interval_miles  INTEGER,                        -- Mercedes Service 8: 30,000 or 50,000
    service_interval_months INTEGER,                        -- Mercedes Service 4: 24
    is_one_time             BOOLEAN DEFAULT FALSE,          -- Mercedes Service 20 "once at 30k"

    description             TEXT,                           -- What this code means / includes

    created_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(system_id, code)
);

-- Now add the FK from maintenance_schedules to service_code_definitions
ALTER TABLE maintenance_schedules
    ADD CONSTRAINT fk_sched_service_code
    FOREIGN KEY (service_code_id) REFERENCES service_code_definitions(id);

CREATE INDEX idx_sched_service_code ON maintenance_schedules(service_code_id);

-- Join table: which maintenance items are included in each service code
CREATE TABLE service_code_items (
    id                      SERIAL PRIMARY KEY,
    service_code_id         INTEGER NOT NULL REFERENCES service_code_definitions(id),
    maintenance_item_id     INTEGER NOT NULL REFERENCES maintenance_items(id),
    action_type             VARCHAR(20) NOT NULL,           -- Same enum as maintenance_schedules.action_type

    -- Some items within a code have additional filters
    applies_to_engine_codes TEXT[],
    applies_to_trans_codes  TEXT[],
    requires_equipment      TEXT[],

    oem_description         TEXT,                           -- OEM instruction text specific to this code+item combo

    UNIQUE(service_code_id, maintenance_item_id, action_type)
);


-- ============================================================================
-- LAYER 6: SERVICE KITS
-- Groups of items that are always done together in practice.
-- Example: Timing belt kit = belt + tensioner + idler + water pump
-- The OEM lists them separately but shops price and sell them as a package.
-- ============================================================================

CREATE TABLE service_kits (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(100) NOT NULL,          -- "Timing Belt Kit", "Major Tune-Up", "Brake Fluid Flush"
    description             TEXT,

    -- Kit can be universal or powertrain-specific
    powertrain_config_id    INTEGER REFERENCES powertrain_configs(id),  -- NULL = universal kit
    oem_make                VARCHAR(50),                    -- NULL = cross-OEM kit definition

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_kit_items (
    id                      SERIAL PRIMARY KEY,
    service_kit_id          INTEGER NOT NULL REFERENCES service_kits(id),
    maintenance_item_id     INTEGER NOT NULL REFERENCES maintenance_items(id),
    is_required             BOOLEAN DEFAULT TRUE,           -- FALSE = optional add-on (e.g., water pump with timing belt)
    notes                   TEXT,

    UNIQUE(service_kit_id, maintenance_item_id)
);


-- ============================================================================
-- LAYER 7: GEMINI DATA INGESTION TRACKING
-- Tracks what has been fetched, validated, and loaded.
-- Prevents duplicate work and provides audit trail.
-- ============================================================================

CREATE TABLE gemini_ingestion_log (
    id                      SERIAL PRIMARY KEY,

    -- What was requested
    request_make            VARCHAR(50) NOT NULL,
    request_model           VARCHAR(100) NOT NULL,
    request_year            SMALLINT NOT NULL,
    request_engine_code     VARCHAR(50),
    request_vin             VARCHAR(17),

    -- Prompt and response tracking
    prompt_template         VARCHAR(50),                    -- Which prompt template was used
    prompt_text             TEXT,                           -- Full prompt sent to Gemini
    raw_response            JSONB,                          -- Raw Gemini JSON response

    -- Processing status
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, parsed, validated, loaded,
                                                                      -- flagged, rejected

    -- Validation results
    items_extracted         INTEGER,
    items_validated         INTEGER,
    items_flagged           INTEGER,
    validation_notes        TEXT,

    -- Which powertrain config this mapped to (after processing)
    powertrain_config_id    INTEGER REFERENCES powertrain_configs(id),

    -- Deduplication
    is_duplicate_config     BOOLEAN DEFAULT FALSE,          -- TRUE if this maps to an existing config
    duplicate_of_log_id     INTEGER REFERENCES gemini_ingestion_log(id),

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    processed_at            TIMESTAMPTZ
);

CREATE INDEX idx_gemini_log_status ON gemini_ingestion_log(status);
CREATE INDEX idx_gemini_log_make_model ON gemini_ingestion_log(request_make, request_model, request_year);


-- ============================================================================
-- VALIDATION RULES
-- Sanity checks applied to Gemini-extracted data before loading.
-- If a schedule entry violates a rule, it's flagged for human review.
-- ============================================================================

CREATE TABLE validation_rules (
    id                      SERIAL PRIMARY KEY,

    -- What this rule checks
    rule_name               VARCHAR(100) NOT NULL,
    rule_description        TEXT NOT NULL,

    -- Matching criteria: which items/actions does this rule apply to?
    applies_to_item_name    VARCHAR(100),                   -- NULL = all items. "Engine Oil", "Spark Plugs", etc.
    applies_to_action_type  VARCHAR(20),                    -- NULL = all actions. "replace", "inspect", etc.

    -- Bounds
    min_interval_miles      INTEGER,                        -- Flag if extracted interval is below this
    max_interval_miles      INTEGER,                        -- Flag if extracted interval is above this
    min_interval_months     INTEGER,
    max_interval_months     INTEGER,

    -- Severity
    severity                VARCHAR(10) DEFAULT 'warning',  -- warning, error, info

    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some baseline validation rules
INSERT INTO validation_rules (rule_name, rule_description, applies_to_item_name, applies_to_action_type, min_interval_miles, max_interval_miles) VALUES
('oil_change_floor',       'Oil change interval below 3,000 miles is suspicious',           'Engine Oil',    'replace', 3000,  NULL),
('oil_change_ceiling',     'Oil change interval above 15,000 miles on gas engine is suspicious', 'Engine Oil', 'replace', NULL, 15000),
('spark_plug_floor',       'Spark plug replacement below 20,000 miles is suspicious',       'Spark Plugs',   'replace', 20000, NULL),
('spark_plug_ceiling',     'Spark plug replacement above 120,000 miles is suspicious',      'Spark Plugs',   'replace', NULL,  120000),
('timing_belt_floor',      'Timing belt replacement below 50,000 miles is suspicious',      'Timing Belt',   'replace', 50000, NULL),
('timing_belt_ceiling',    'Timing belt replacement above 200,000 miles is suspicious',     'Timing Belt',   'replace', NULL,  200000),
('brake_fluid_floor',      'Brake fluid replacement below 12 months is suspicious',         'Brake Fluid',   'replace', NULL,  NULL),
('coolant_floor',          'Coolant replacement below 24,000 miles is suspicious',          'Coolant',        'replace', 24000, NULL),
('coolant_ceiling',        'Coolant replacement above 150,000 miles is suspicious',         'Coolant',        'replace', NULL,  150000),
('atf_ceiling',            'ATF replacement above 120,000 miles is suspicious',             'Fluid - A/T',   'replace', NULL,  120000),
('tire_rotation_floor',    'Tire rotation below 3,000 miles is suspicious',                 'Tires',          'rotate',  3000,  NULL),
('tire_rotation_ceiling',  'Tire rotation above 10,000 miles is suspicious',                'Tires',          'rotate',  NULL,  10000);


-- ============================================================================
-- SEED DATA: MAINTENANCE ITEM CATEGORIES
-- ============================================================================

INSERT INTO maintenance_item_categories (name, display_order) VALUES
('engine',                1),
('ignition',              2),
('fuel_system',           3),
('exhaust',               4),
('cooling',               5),
('transmission',          6),
('drivetrain',            7),
('brakes',                8),
('steering_suspension',   9),
('tires_wheels',         10),
('electrical',           11),
('hvac',                 12),
('filters',              13),
('fluids',               14),
('body',                 15),
('safety',               16);


-- ============================================================================
-- SEED DATA: COMMON MAINTENANCE ITEMS
-- Normalized names with OEM aliases for matching during ingestion
-- ============================================================================

INSERT INTO maintenance_items (category_id, name, name_aliases, is_powertrain_dependent, is_emissions_related, wear_type) VALUES

-- Engine
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'Engine Oil',
    '{"Engine Oil", "Oil, Engine", "Motor Oil"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'Drive Belt',
    '{"Drive Belt", "Serpentine Belt", "Poly-V-Belt", "Accessory Belt"}', TRUE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'Timing Belt',
    '{"Timing Belt", "Timing Components"}', TRUE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'Timing Belt Tensioner',
    '{"Timing Belt Tensioner"}', TRUE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'Timing Belt Idler Pulley',
    '{"Timing Belt Idler Pulley", "Idler Pulley"}', TRUE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'Drive Belt Tensioner',
    '{"Drive Belt Tensioner"}', TRUE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'PCV Valve',
    '{"PCV Valve", "Positive Crankcase Ventilation Valve"}', TRUE, TRUE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'engine'), 'Valve Clearance',
    '{"Valve Clearance", "Valve Adjustment", "Valve Lash"}', TRUE, FALSE, 'mechanical_wear'),

-- Ignition
((SELECT id FROM maintenance_item_categories WHERE name = 'ignition'), 'Spark Plugs',
    '{"Spark Plug", "Spark Plugs", "Ignition Plugs"}', TRUE, TRUE, 'mechanical_wear'),

-- Filters
((SELECT id FROM maintenance_item_categories WHERE name = 'filters'), 'Engine Oil Filter',
    '{"Oil Filter, Engine", "Engine Oil Filter", "Oil Filter"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'filters'), 'Air Filter Element',
    '{"Air Filter Element", "Engine Air Filter", "Air Cleaner Filter", "Air Cleaner Element"}', TRUE, TRUE, 'condition_based'),
((SELECT id FROM maintenance_item_categories WHERE name = 'filters'), 'Cabin Air Filter',
    '{"Cabin Air Filter / Purifier", "Cabin Air Filter", "Pollen Filter", "Dust and Pollen Filter", "Activated Charcoal Filter"}', FALSE, FALSE, 'condition_based'),
((SELECT id FROM maintenance_item_categories WHERE name = 'filters'), 'Fuel Filter',
    '{"Fuel Filter"}', TRUE, TRUE, 'condition_based'),

-- Fluids
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Brake Fluid',
    '{"Brake Fluid"}', FALSE, FALSE, 'chemical_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Coolant',
    '{"Coolant", "Engine Coolant", "Antifreeze"}', TRUE, FALSE, 'chemical_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Automatic Transmission Fluid',
    '{"Fluid - A/T", "ATF", "Automatic Transmission Fluid", "Transmission Fluid"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Manual Transmission Fluid',
    '{"Manual Transmission Fluid", "MTF"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'CVT Fluid',
    '{"Transmission Fluid (HCF-2)", "CVT Fluid"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Differential Fluid',
    '{"Fluid - Differential", "Differential Oil", "Rear Axle Oil", "Front Axle Oil"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Transfer Case Fluid',
    '{"Fluid - Transfer Case", "Transfer Case Oil"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Power Steering Fluid',
    '{"Power Steering Fluid"}', TRUE, FALSE, 'fluid_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fluids'), 'Washer Fluid',
    '{"Washer Fluid", "Windshield Washer Fluid"}', FALSE, FALSE, NULL),

-- Brakes
((SELECT id FROM maintenance_item_categories WHERE name = 'brakes'), 'Brake Pads',
    '{"Disc Brake System", "Brake Pad", "Brake Pads", "Brake Pads/Discs"}', FALSE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'brakes'), 'Brake Rotors',
    '{"Brake Discs", "Brake Rotors"}', FALSE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'brakes'), 'Drum Brakes',
    '{"Drum Brake System", "Brake Linings", "Brake Shoes"}', FALSE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'brakes'), 'Brake Hoses and Lines',
    '{"Brake Hose/Line", "Brake Hoses", "Brake Lines"}', FALSE, FALSE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'brakes'), 'Parking Brake',
    '{"Parking Brake System", "Parking Brake"}', FALSE, FALSE, 'mechanical_wear'),

-- Steering & Suspension
((SELECT id FROM maintenance_item_categories WHERE name = 'steering_suspension'), 'Steering Components',
    '{"Steering", "Steering Gear", "Steering Linkage"}', FALSE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'steering_suspension'), 'Suspension Components',
    '{"Steering and Suspension", "Suspension", "Front Suspension", "Rear Suspension"}', FALSE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'steering_suspension'), 'Ball Joints',
    '{"Ball Joint", "Ball Joints"}', FALSE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'steering_suspension'), 'Tie Rod Ends',
    '{"Tie Rod End", "Tie Rod Boot", "Tie Rod Ends"}', FALSE, FALSE, 'mechanical_wear'),

-- Drivetrain
((SELECT id FROM maintenance_item_categories WHERE name = 'drivetrain'), 'CV Joint Boots',
    '{"Constant Velocity Joint Boot", "CV Joint", "Driveshaft Boots", "Axle Shaft Assembly"}', FALSE, FALSE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'drivetrain'), 'Propeller Shaft',
    '{"Drive/Propeller Shaft", "Propeller Shaft", "Driveshaft"}', TRUE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'drivetrain'), 'Drive Shaft Joints',
    '{"Axle Joint", "Drive Shaft Joints", "U-Joints", "Flex Discs", "Companion Flange"}', TRUE, FALSE, 'mechanical_wear'),

-- Tires & Wheels
((SELECT id FROM maintenance_item_categories WHERE name = 'tires_wheels'), 'Tires',
    '{"Tires", "Wheels and Tires"}', FALSE, FALSE, 'mechanical_wear'),
((SELECT id FROM maintenance_item_categories WHERE name = 'tires_wheels'), 'Spare Tire',
    '{"Spare Tire"}', FALSE, FALSE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'tires_wheels'), 'TPMS',
    '{"Tire Monitoring System", "TPMS"}', FALSE, FALSE, NULL),

-- Exhaust
((SELECT id FROM maintenance_item_categories WHERE name = 'exhaust'), 'Exhaust System',
    '{"Exhaust System"}', FALSE, TRUE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'exhaust'), 'Evaporative Emissions System',
    '{"Evaporative Emissions System", "Evaporative Emissions Hose", "EVAP"}', TRUE, TRUE, 'time_degradation'),

-- Fuel System
((SELECT id FROM maintenance_item_categories WHERE name = 'fuel_system'), 'Fuel Lines',
    '{"Fuel Supply Line", "Fuel Return Line", "Fuel Lines"}', FALSE, TRUE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fuel_system'), 'Fuel Filler Cap',
    '{"Fuel Filler Cap"}', FALSE, TRUE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fuel_system'), 'Fuel Tank Mounting',
    '{"Fuel Tank Mounting Straps"}', FALSE, FALSE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'fuel_system'), 'Fuel Delivery and Air Induction',
    '{"Fuel Delivery and Air Induction"}', TRUE, TRUE, 'condition_based'),

-- Cooling
((SELECT id FROM maintenance_item_categories WHERE name = 'cooling'), 'Radiator',
    '{"Radiator"}', FALSE, FALSE, 'condition_based'),
((SELECT id FROM maintenance_item_categories WHERE name = 'cooling'), 'HVAC Condenser',
    '{"Condenser HVAC"}', FALSE, FALSE, 'condition_based'),

-- Electrical
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Battery',
    '{"Battery"}', FALSE, FALSE, 'chemical_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Headlamps',
    '{"Headlamp", "Headlamp Alignment", "Fog/Driving Lamp"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Exterior Lighting',
    '{"Lighting and Horns", "Exterior Lights", "Lighting and Horns - Exterior Lights"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Interior Lighting',
    '{"Lighting and Horns - Illumination and Interior Lighting", "Trunk Lamp"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Horn',
    '{"Horn"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Key Fob Battery',
    '{"Keyless Entry Transmitter Battery"}', FALSE, FALSE, 'chemical_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Warning Indicators',
    '{"Instrument Panel, Gauges and Warning Indicators"}', FALSE, FALSE, NULL),

-- HVAC
((SELECT id FROM maintenance_item_categories WHERE name = 'hvac'), 'Wiper Blades',
    '{"Wiper Blade", "Wiper Blades", "Wiper and Washer Systems"}', FALSE, FALSE, 'time_degradation'),

-- Body
((SELECT id FROM maintenance_item_categories WHERE name = 'body'), 'Door Hinges and Locks',
    '{"Doors", "Hood"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'body'), 'Sunroof Track',
    '{"Sunroof / Moonroof Track"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'body'), 'Underbody',
    '{"Underbody Cover", "Body and Frame"}', FALSE, FALSE, 'condition_based'),
((SELECT id FROM maintenance_item_categories WHERE name = 'body'), 'Paint',
    '{"Paint"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'body'), 'Windshield Camera Area',
    '{"Windshield"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'body'), 'Cowl/Water Deflector',
    '{"Cowl"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'body'), 'Air Cleaner Housing',
    '{"Air Cleaner Housing"}', FALSE, FALSE, NULL),

-- Safety
((SELECT id FROM maintenance_item_categories WHERE name = 'safety'), 'Seat Belts',
    '{"Seat Belt", "Seat Belt Systems", "Restraints and Safety Systems"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'safety'), 'First Aid Kit',
    '{"Kit - First Aid"}', FALSE, FALSE, 'time_degradation'),
((SELECT id FROM maintenance_item_categories WHERE name = 'safety'), 'Tire Sealant',
    '{"Tire Inflator Bottle", "TIREFIT"}', FALSE, FALSE, 'time_degradation'),

-- Service Actions (not components, but standard service operations)
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Service Reminder Reset',
    '{"Service Reminder Indicators", "Maintenance Required Lamp/Indicator", "Oil Change Reminder Lamp", "Reset"}', FALSE, FALSE, NULL),
((SELECT id FROM maintenance_item_categories WHERE name = 'electrical'), 'Suspension Control System',
    '{"Suspension Control ( Automatic - Electronic )", "Suspension Fluid", "Active Body Control"}', FALSE, FALSE, NULL);


-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- What's due at a given mileage for a specific vehicle?
CREATE OR REPLACE VIEW v_schedule_with_details AS
SELECT
    ms.id AS schedule_id,
    pc.oem_make,
    pc.engine_code,
    pc.displacement_liters,
    pc.transmission_type,
    pc.drive_type,
    mic.name AS category,
    mi.name AS item_name,
    ms.action_type,
    ms.interval_type,
    ms.interval_miles,
    ms.interval_months,
    ms.severe_interval_miles,
    ms.severe_interval_months,
    ms.ah_interval_miles,
    ms.ah_interval_months,
    ms.requirement_level,
    ms.warranty_class,
    ms.oem_description,
    ms.severe_use_conditions,
    ms.requires_equipment,
    ms.data_source,
    ms.data_confidence,
    ms.needs_review
FROM maintenance_schedules ms
JOIN powertrain_configs pc ON ms.powertrain_config_id = pc.id
JOIN maintenance_items mi ON ms.maintenance_item_id = mi.id
JOIN maintenance_item_categories mic ON mi.category_id = mic.id
ORDER BY mic.display_order, mi.name, ms.action_type;


-- Powertrain configs with vehicle application counts
CREATE OR REPLACE VIEW v_powertrain_coverage AS
SELECT
    pc.id,
    pc.oem_make,
    pc.engine_code,
    pc.engine_family,
    pc.displacement_liters,
    pc.forced_induction_type,
    pc.transmission_type,
    pc.drive_type,
    COUNT(DISTINCT va.id) AS vehicle_application_count,
    COUNT(DISTINCT ms.id) AS schedule_entry_count,
    ARRAY_AGG(DISTINCT va.make || ' ' || va.model ORDER BY va.make || ' ' || va.model) AS vehicle_models
FROM powertrain_configs pc
LEFT JOIN vehicle_applications va ON pc.id = va.powertrain_config_id
LEFT JOIN maintenance_schedules ms ON pc.id = ms.powertrain_config_id
GROUP BY pc.id;


-- Gemini ingestion dashboard
CREATE OR REPLACE VIEW v_ingestion_status AS
SELECT
    status,
    COUNT(*) AS total,
    SUM(items_extracted) AS total_items_extracted,
    SUM(items_flagged) AS total_items_flagged,
    COUNT(DISTINCT powertrain_config_id) AS unique_configs,
    COUNT(*) FILTER (WHERE is_duplicate_config) AS duplicate_configs
FROM gemini_ingestion_log
GROUP BY status;

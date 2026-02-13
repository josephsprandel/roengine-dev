-- Migration 017: AI Service Advisor Maintenance Schedule Database
-- Extends maintenance_schedules for AI-powered service recommendations
-- Created: 2026-02-11

-- ============================================================================
-- EXTEND MAINTENANCE_SCHEDULES TABLE
-- ============================================================================

-- Add year range instead of single year (supports multi-year specifications)
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS year_start INTEGER;
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS year_end INTEGER;

-- Add time-based interval (e.g., "every 6 months")
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS interval_months INTEGER;

-- Add labor hours for cost estimation
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS labor_hours DECIMAL(4,2);

-- Add parts description for AI context
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS parts_description TEXT;

-- Add customer-facing explanation
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS customer_explanation TEXT;

-- Add physics/engineering explanation
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS why_it_matters TEXT;

-- Migrate existing year to year_start/year_end
UPDATE maintenance_schedules
SET year_start = year, year_end = year
WHERE year_start IS NULL;

-- Make old year column nullable (it's deprecated but we'll keep it for backward compatibility)
ALTER TABLE maintenance_schedules ALTER COLUMN year DROP NOT NULL;

-- ============================================================================
-- SERVICE CATALOG TABLE (MASTER SERVICE REFERENCE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_catalog (
  id SERIAL PRIMARY KEY,

  -- Service identification
  name VARCHAR(200) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,  -- oil_change, brake_service, filter_replacement, etc.

  -- Description & explanation
  description TEXT,
  customer_explanation TEXT,
  why_it_matters TEXT,

  -- Typical costs (baseline estimates)
  typical_labor_hours DECIMAL(4,2),
  typical_parts_cost DECIMAL(8,2),

  -- Urgency classification
  urgency_level VARCHAR(20) CHECK (urgency_level IN ('critical', 'recommended', 'suggested')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SEED SERVICE CATALOG (MASTER DATA)
-- ============================================================================

INSERT INTO service_catalog (name, category, description, customer_explanation, why_it_matters, typical_labor_hours, typical_parts_cost, urgency_level) VALUES

-- Engine Oil
('Engine Oil Change', 'oil_change',
  'Replace engine oil and filter',
  'Fresh oil keeps your engine running smoothly and prevents costly repairs. Old oil loses its ability to protect moving parts and can cause engine damage.',
  'Motor oil lubricates metal components moving at thousands of RPMs, preventing friction-induced heat (up to 400°F) and wear. Oil degrades over time due to thermal breakdown and contamination, losing its viscosity and protective properties.',
  0.5, 45.00, 'recommended'),

-- Transmission
('Transmission Fluid Service', 'transmission_service',
  'Drain and replace transmission fluid',
  'Transmission fluid keeps your gears shifting smoothly and prevents expensive transmission repairs. Old fluid can cause rough shifting and transmission failure.',
  'Transmission fluid serves three critical functions: hydraulic pressure for gear changes (up to 300 PSI), heat dissipation (transmission temperatures can exceed 200°F), and lubrication of gears and clutches. Degraded fluid loses viscosity, reducing pressure and causing slippage.',
  1.5, 180.00, 'recommended'),

-- Brake Fluid
('Brake Fluid Flush', 'brake_service',
  'Flush and replace brake fluid',
  'Brake fluid absorbs moisture over time, which reduces braking power and can lead to brake failure in emergency situations.',
  'Brake fluid is hygroscopic (absorbs water from air). Water contamination lowers the boiling point from 500°F to as low as 300°F, causing vapor lock under heavy braking where hydraulic pressure is replaced by compressible gas bubbles, resulting in brake pedal failure.',
  1.0, 35.00, 'critical'),

-- Coolant
('Coolant Flush', 'coolant_service',
  'Drain and replace engine coolant/antifreeze',
  'Coolant prevents your engine from overheating in summer and freezing in winter. Old coolant loses its protective additives and can cause corrosion and expensive engine damage.',
  'Coolant maintains engine temperature between 195-220°F using a 50/50 water-glycol mixture. Additives prevent corrosion, cavitation, and scale buildup. Over time, additives deplete and pH drops, causing galvanic corrosion between dissimilar metals (aluminum, steel, copper).',
  1.2, 75.00, 'recommended'),

-- Cabin Air Filter
('Cabin Air Filter Replacement', 'filter_replacement',
  'Replace cabin air filter',
  'A clean cabin air filter improves air quality inside your vehicle and helps your AC/heating work efficiently. A dirty filter can cause musty odors and reduced airflow.',
  'The cabin filter captures particulates as small as 3 microns (pollen, dust, pollution) before air enters the HVAC system. Clogged filters increase static pressure, forcing the blower motor to work harder, reducing airflow by up to 50% and increasing electrical load.',
  0.3, 25.00, 'suggested'),

-- Engine Air Filter
('Engine Air Filter Replacement', 'filter_replacement',
  'Replace engine air filter',
  'A clean air filter ensures your engine gets the air it needs to run efficiently and produce full power. A dirty filter wastes gas and reduces performance.',
  'Internal combustion engines require a precise air-fuel ratio (14.7:1 for gasoline). A restricted air filter reduces volumetric efficiency, enriching the mixture and causing incomplete combustion. This increases emissions, reduces power, and wastes fuel (up to 10% MPG loss).',
  0.3, 30.00, 'suggested'),

-- Spark Plugs
('Spark Plug Replacement', 'ignition_service',
  'Replace engine spark plugs',
  'Spark plugs ignite the fuel in your engine. Worn plugs cause misfires, rough running, poor fuel economy, and can damage your catalytic converter.',
  'Spark plugs generate a 40,000-volt arc across a precise gap (0.028-0.060") to ignite the compressed air-fuel mixture. Electrode erosion from repeated electrical discharge and thermal stress increases gap width, requiring higher voltage. Eventually, the ignition coil cannot supply sufficient voltage, causing misfires.',
  1.5, 120.00, 'recommended'),

-- Differential Fluid
('Differential Fluid Service', 'differential_service',
  'Drain and replace differential fluid',
  'Differential fluid lubricates the gears that allow your wheels to turn at different speeds when cornering. Old fluid can cause noise, wear, and expensive differential failure.',
  'The differential uses hypoid gears that slide rather than roll, generating extreme pressure (up to 300,000 PSI at gear contact points) and heat. Special gear oil with EP (Extreme Pressure) additives prevents metal-to-metal contact. Degraded fluid loses film strength, allowing gear wear.',
  1.0, 65.00, 'recommended'),

-- Timing Belt
('Timing Belt Replacement', 'belts_hoses',
  'Replace engine timing belt',
  'The timing belt synchronizes your engine''s valves and pistons. If it breaks, your engine can suffer catastrophic damage requiring thousands of dollars in repairs.',
  'The timing belt synchronizes crankshaft and camshaft rotation, ensuring valves open/close precisely as pistons move. In interference engines, valve-to-piston clearance can be less than 0.040". Belt failure causes valves to remain open when pistons reach top dead center, resulting in bent valves, damaged pistons, and potential head/block damage.',
  4.0, 450.00, 'critical'),

-- Tire Rotation
('Tire Rotation', 'tire_service',
  'Rotate tires to ensure even wear',
  'Regular tire rotation extends tire life and improves handling and safety. Front and rear tires wear differently based on weight distribution and steering forces.',
  'Front tires on FWD vehicles experience 60% of vehicle weight plus lateral forces from steering (up to 1.2g in hard cornering). Rear tires wear more evenly. Rotating tires every 7,500 miles equalizes wear rates, extending tire life by up to 30% and maintaining balanced handling characteristics.',
  0.5, 0.00, 'suggested'),

-- Brake Inspection
('Brake Inspection', 'brake_service',
  'Inspect brake pads, rotors, and calipers',
  'Regular brake inspections catch wear before it becomes dangerous or causes expensive rotor damage. Worn brakes increase stopping distance and can fail in emergencies.',
  'Brake pads use friction to convert kinetic energy into heat (up to 600°F during heavy braking). Pads wear at different rates based on material (ceramic, semi-metallic, organic). Minimum thickness is typically 3mm - below this, the backing plate contacts rotors, scoring them and requiring replacement (4x more expensive).',
  0.5, 0.00, 'recommended'),

-- Battery Test
('Battery Test', 'battery_service',
  'Load test battery and charging system',
  'A failing battery leaves you stranded. Regular testing catches problems before they leave you calling for a tow truck.',
  'Lead-acid batteries produce 12.6V via electrochemical reaction between lead plates and sulfuric acid. Sulfation (lead sulfate crystal formation) reduces capacity over time. Cold weather reduces chemical reaction rate - at 0°F, a battery has only 40% of its rated cranking amps. Load testing applies 50% of CCA rating for 15 seconds to identify weak cells.',
  0.3, 0.00, 'suggested')

ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED VOLVO MAINTENANCE SCHEDULES
-- ============================================================================

-- Delete any existing Volvo schedules to prevent duplicates
DELETE FROM maintenance_schedules WHERE make = 'Volvo';

INSERT INTO maintenance_schedules (
  year_start, year_end, make, model,
  service_name, service_category,
  mileage_interval, interval_months,
  labor_hours, parts_description,
  customer_explanation, why_it_matters,
  driving_condition
) VALUES

-- ============================================================================
-- VOLVO XC60 (2010-2024)
-- ============================================================================

-- Engine Oil (5K/6mo)
(2010, 2024, 'Volvo', 'XC60',
  'Engine Oil Change', 'oil_change',
  5000, 6,
  0.5, '6.5 quarts 0W-20 synthetic oil, OEM oil filter',
  'Volvo engines require full synthetic oil changed every 5,000 miles or 6 months. This keeps your turbocharger cool and prevents sludge buildup.',
  'Volvo turbocharged engines generate extreme heat (turbos spin at 150,000 RPM and reach 1400°F). Synthetic oil maintains viscosity at these temperatures and prevents turbo bearing failure, which costs $2,000-4,000 to replace.',
  'normal'),

-- Transmission Fluid (60K/4yr)
(2010, 2024, 'Volvo', 'XC60',
  'Transmission Fluid Service', 'transmission_service',
  60000, 48,
  1.5, '7 quarts Aisin AFW+ transmission fluid',
  'Your Volvo''s automatic transmission needs fresh fluid every 60,000 miles to keep shifts smooth and prevent expensive transmission problems.',
  'Volvo''s Aisin 8-speed transmission uses specialized AFW+ fluid with friction modifiers for clutch packs. Unlike conventional ATF, this fluid operates at higher pressures (up to 350 PSI) and temperatures. Degraded fluid causes harsh shifts and clutch slippage.',
  'normal'),

-- Brake Fluid (30K/3yr)
(2010, 2024, 'Volvo', 'XC60',
  'Brake Fluid Flush', 'brake_service',
  30000, 36,
  1.0, 'DOT 4 brake fluid',
  'Brake fluid absorbs moisture and should be replaced every 30,000 miles or 3 years to maintain safe, reliable braking.',
  'DOT 4 fluid has a dry boiling point of 446°F, but absorbs 2-3% water per year from humidity. At 3% contamination, boiling point drops to 311°F. Volvo brakes can reach 400°F+ during mountain driving, risking vapor lock and complete brake failure.',
  'normal'),

-- Coolant (60K/5yr)
(2010, 2024, 'Volvo', 'XC60',
  'Coolant Flush', 'coolant_service',
  60000, 60,
  1.2, '2 gallons Volvo coolant (blue - organic acid technology)',
  'Volvo uses special long-life coolant that lasts 5 years or 60,000 miles. Old coolant loses its anti-corrosion properties and can damage aluminum components.',
  'Volvo engines use aluminum blocks and heads. Their OAT (Organic Acid Technology) coolant prevents galvanic corrosion between aluminum and steel. Generic coolant can cause electrolysis, eating away at aluminum and creating pinhole leaks. OAT coolant maintains pH 8.5-9.5 to prevent this.',
  'normal'),

-- Cabin Air Filter (15K/1yr)
(2010, 2024, 'Volvo', 'XC60',
  'Cabin Air Filter Replacement', 'filter_replacement',
  15000, 12,
  0.3, 'Volvo cabin air filter (behind glove box)',
  'Replace your cabin air filter yearly to maintain good air quality and efficient heating/AC performance.',
  'The cabin filter removes particles as small as 3 microns. A clogged filter increases HVAC blower motor current draw by up to 40%, risking motor burnout. It also reduces airflow, making the AC compressor work harder and reducing fuel economy.',
  'normal'),

-- Engine Air Filter (30K/2yr)
(2010, 2024, 'Volvo', 'XC60',
  'Engine Air Filter Replacement', 'filter_replacement',
  30000, 24,
  0.3, 'Volvo engine air filter',
  'A clean engine air filter ensures your turbo gets clean air and your engine runs at peak efficiency.',
  'Turbocharged engines are especially sensitive to air filter restriction. Even a moderately dirty filter reduces boost pressure, robbing power and efficiency. Particles that bypass the filter score the turbo compressor blades, causing imbalance and early failure.',
  'normal'),

-- Spark Plugs (60K)
(2010, 2024, 'Volvo', 'XC60',
  'Spark Plug Replacement', 'ignition_service',
  60000, NULL,
  1.5, '4 or 5 iridium spark plugs (depending on engine)',
  'Replace spark plugs at 60,000 miles to prevent misfires, maintain fuel economy, and protect your catalytic converter.',
  'Iridium plugs can withstand temperatures up to 4,500°F but the electrode wears about 0.001" per 10,000 miles. By 60,000 miles, the gap has widened enough to require 10-15% more voltage. Misfires from worn plugs send unburned fuel into the catalytic converter, overheating it (1,400°F+) and causing substrate meltdown.',
  'normal'),

-- Differential Fluid (60K/4yr) - AWD models
(2010, 2024, 'Volvo', 'XC60',
  'Differential Fluid Service', 'differential_service',
  60000, 48,
  1.0, '1.5 quarts synthetic 75W-90 gear oil (AWD models)',
  'AWD Volvo XC60s have a rear differential that needs fluid service every 60,000 miles to prevent noise and wear.',
  'The Haldex AWD system can transfer 100% of torque to the rear wheels instantly. The differential uses hypoid gears with sliding contact under extreme pressure. Synthetic 75W-90 with EP additives forms a protective film just 0.0001" thick that prevents metal-to-metal contact under 300,000 PSI loads.',
  'normal'),

-- Timing Belt - NOTE: Most XC60s have timing chains, not belts
-- Only early T5 engines (2010-2015) had belts
(2010, 2015, 'Volvo', 'XC60',
  'Timing Belt Replacement', 'belts_hoses',
  105000, NULL,
  4.5, 'Timing belt, tensioner, idler pulley, water pump',
  'The timing belt is critical - if it breaks, your engine will suffer catastrophic damage. Replace it at 105,000 miles along with the water pump.',
  'The XC60 T5 has an interference engine where valves and pistons occupy the same space at different times, separated by precise timing. If the belt breaks, valves remain open as pistons reach top dead center, causing collision at 3,000+ RPM. This bends valves, damages pistons, and can crack the cylinder head - repairs typically cost $4,000-8,000.',
  'normal'),

-- Tire Rotation (7.5K)
(2010, 2024, 'Volvo', 'XC60',
  'Tire Rotation', 'tire_service',
  7500, NULL,
  0.5, 'None - rotation only',
  'Rotate tires every 7,500 miles to ensure even wear and maximum tire life.',
  'FWD and AWD vehicles put more load on front tires (60-65% of vehicle weight plus steering forces). Front tires wear 20-30% faster than rears. Regular rotation equalizes wear, extending tire life by 8,000-12,000 miles and maintaining balanced handling.',
  'normal'),

-- Brake Inspection (15K/1yr)
(2010, 2024, 'Volvo', 'XC60',
  'Brake Inspection', 'brake_service',
  15000, 12,
  0.5, 'None - inspection only',
  'Annual brake inspections catch wear before it becomes dangerous or damages your rotors.',
  'Volvo brake pads have wear indicators that start squealing at 4mm thickness, but minimum safe thickness is 3mm. Waiting too long scores the rotors, requiring replacement ($400+ vs $250 for pads alone). Regular inspection prevents this costly damage.',
  'normal'),

-- Battery Test (30K/2yr)
(2010, 2024, 'Volvo', 'XC60',
  'Battery Test', 'battery_service',
  30000, 24,
  0.3, 'None - test only',
  'Test your battery every 2 years to catch problems before you''re left stranded.',
  'Volvo batteries face high loads from seat heaters, AWD systems, and electronics. Load testing applies half the CCA rating for 15 seconds - a healthy battery maintains 9.6V+ under load. Weak cells are revealed before they fail, preventing the $150 tow truck call.',
  'normal'),

-- ============================================================================
-- VOLVO XC90 (2003-2024)
-- ============================================================================

-- Engine Oil (5K/6mo)
(2003, 2024, 'Volvo', 'XC90',
  'Engine Oil Change', 'oil_change',
  5000, 6,
  0.5, '6.5-7.5 quarts 0W-20 or 5W-30 synthetic oil (varies by year), OEM oil filter',
  'Volvo engines require full synthetic oil changed every 5,000 miles or 6 months. This keeps your turbocharger cool and prevents sludge buildup.',
  'Volvo turbocharged engines generate extreme heat (turbos spin at 150,000 RPM and reach 1400°F). Synthetic oil maintains viscosity at these temperatures and prevents turbo bearing failure, which costs $2,000-4,000 to replace.',
  'normal'),

-- Transmission Fluid (60K/4yr)
(2003, 2024, 'Volvo', 'XC90',
  'Transmission Fluid Service', 'transmission_service',
  60000, 48,
  1.5, '7-8 quarts transmission fluid (Aisin AFW+ or Volvo spec)',
  'Your Volvo''s automatic transmission needs fresh fluid every 60,000 miles to keep shifts smooth and prevent expensive transmission problems.',
  'Volvo transmissions operate at high pressures and temperatures. Degraded fluid loses friction modifiers, causing clutch slippage and harsh shifts. Transmission replacement costs $6,000-8,000, while fluid service costs $300.',
  'normal'),

-- Brake Fluid (30K/3yr)
(2003, 2024, 'Volvo', 'XC90',
  'Brake Fluid Flush', 'brake_service',
  30000, 36,
  1.0, 'DOT 4 brake fluid',
  'Brake fluid absorbs moisture and should be replaced every 30,000 miles or 3 years to maintain safe, reliable braking.',
  'XC90s are heavy vehicles (4,600+ lbs) requiring strong braking power. Contaminated fluid can boil during emergency stops, causing complete brake failure. DOT 4 fluid loses 50% of its boiling point after 3 years of moisture absorption.',
  'normal'),

-- Coolant (60K/5yr)
(2003, 2024, 'Volvo', 'XC90',
  'Coolant Flush', 'coolant_service',
  60000, 60,
  1.2, '2.5-3 gallons Volvo coolant (blue - organic acid technology)',
  'Volvo uses special long-life coolant that lasts 5 years or 60,000 miles. Old coolant loses its anti-corrosion properties and can damage aluminum components.',
  'Older XC90s (2003-2014) had issues with coolant system corrosion causing heater core failures ($1,500 repair). Maintaining fresh Volvo OAT coolant prevents galvanic corrosion of aluminum parts by keeping pH between 8.5-9.5.',
  'normal'),

-- Cabin Air Filter (15K/1yr)
(2003, 2024, 'Volvo', 'XC90',
  'Cabin Air Filter Replacement', 'filter_replacement',
  15000, 12,
  0.3, 'Volvo cabin air filter',
  'Replace your cabin air filter yearly to maintain good air quality and efficient heating/AC performance.',
  'A clogged cabin filter reduces HVAC efficiency by up to 40%, making the AC compressor work harder and increasing fuel consumption. It also allows allergens and pollutants into the cabin.',
  'normal'),

-- Engine Air Filter (30K/2yr)
(2003, 2024, 'Volvo', 'XC90',
  'Engine Air Filter Replacement', 'filter_replacement',
  30000, 24,
  0.3, 'Volvo engine air filter',
  'A clean engine air filter ensures your engine runs at peak efficiency and your turbo stays healthy.',
  'Turbocharged engines require clean air. Even small particles that bypass a dirty filter can damage turbo compressor blades spinning at 150,000 RPM, causing imbalance and bearing failure ($2,500+ repair).',
  'normal'),

-- Spark Plugs (60K)
(2003, 2024, 'Volvo', 'XC90',
  'Spark Plug Replacement', 'ignition_service',
  60000, NULL,
  2.0, '6 or 8 iridium spark plugs (depending on engine)',
  'Replace spark plugs at 60,000 miles to prevent misfires and protect your catalytic converter.',
  'V8 and inline-6 engines have plugs in difficult locations. Worn plugs cause misfires that dump raw fuel into the catalytic converter, overheating it to 1,400°F+ and causing substrate failure ($2,000+ repair).',
  'normal'),

-- Differential Fluid (60K/4yr) - AWD
(2003, 2024, 'Volvo', 'XC90',
  'Differential Fluid Service', 'differential_service',
  60000, 48,
  1.0, '1.5 quarts synthetic 75W-90 gear oil',
  'All XC90s have AWD and need rear differential fluid service every 60,000 miles to prevent noise and wear.',
  'The XC90 uses a Haldex AWD system that can transfer 100% torque to the rear instantly. The rear differential operates under extreme pressure (300,000 PSI at gear contact points). Fresh fluid with EP additives prevents gear wear and noise.',
  'normal'),

-- Tire Rotation (7.5K)
(2003, 2024, 'Volvo', 'XC90',
  'Tire Rotation', 'tire_service',
  7500, NULL,
  0.5, 'None - rotation only',
  'Rotate tires every 7,500 miles to ensure even wear and maximum tire life.',
  'The XC90 is a heavy SUV (4,600-5,200 lbs) that wears tires faster than lighter vehicles. AWD distributes power to all wheels, but front tires still wear faster due to steering forces. Regular rotation extends tire life by 25-30%.',
  'normal'),

-- Brake Inspection (15K/1yr)
(2003, 2024, 'Volvo', 'XC90',
  'Brake Inspection', 'brake_service',
  15000, 12,
  0.5, 'None - inspection only',
  'Annual brake inspections are critical for this heavy SUV to maintain safe stopping power.',
  'The XC90 weighs 2.5 tons and requires strong brakes. Front brakes do 70% of the stopping work and wear faster. Regular inspection prevents rotor damage when pads wear to metal ($600+ vs $350 for just pads).',
  'normal'),

-- Battery Test (30K/2yr)
(2003, 2024, 'Volvo', 'XC90',
  'Battery Test', 'battery_service',
  30000, 24,
  0.3, 'None - test only',
  'Test your battery every 2 years to avoid being stranded.',
  'The XC90 has high electrical loads (AWD, heated seats, third-row accessories). Batteries typically last 4-5 years. Testing every 2 years catches weak cells before total failure.',
  'normal'),

-- ============================================================================
-- VOLVO S60 (2001-2024)
-- ============================================================================

-- Engine Oil (5K/6mo)
(2001, 2024, 'Volvo', 'S60',
  'Engine Oil Change', 'oil_change',
  5000, 6,
  0.5, '6.5 quarts 0W-20 or 5W-30 synthetic oil, OEM oil filter',
  'Volvo engines require full synthetic oil changed every 5,000 miles or 6 months for optimal turbo protection.',
  'Turbocharged engines reach extreme temperatures. Synthetic oil resists thermal breakdown and maintains film strength at turbo bearing temperatures exceeding 300°F, preventing the $3,000+ turbo replacement.',
  'normal'),

-- Transmission Fluid (60K/4yr)
(2001, 2024, 'Volvo', 'S60',
  'Transmission Fluid Service', 'transmission_service',
  60000, 48,
  1.5, '7 quarts Aisin AFW+ or Volvo transmission fluid',
  'Your transmission needs fresh fluid every 60,000 miles to prevent expensive repairs.',
  'Volvo''s 8-speed Aisin transmission uses high-pressure hydraulics (350 PSI) and multiple clutch packs. Degraded fluid causes harsh shifts and slippage, leading to $5,000+ transmission rebuilds.',
  'normal'),

-- Brake Fluid (30K/3yr)
(2001, 2024, 'Volvo', 'S60',
  'Brake Fluid Flush', 'brake_service',
  30000, 36,
  1.0, 'DOT 4 brake fluid',
  'Fresh brake fluid ensures reliable, safe braking performance.',
  'DOT 4 fluid absorbs 2-3% water per year. Water contamination drops boiling point from 446°F to 311°F in 3 years. During hard braking (mountain roads, emergency stops), fluid can reach 350-400°F, risking vapor lock and brake failure.',
  'normal'),

-- Coolant (60K/5yr)
(2001, 2024, 'Volvo', 'S60',
  'Coolant Flush', 'coolant_service',
  60000, 60,
  1.2, '2 gallons Volvo blue coolant (OAT)',
  'Volvo coolant protects aluminum engine components from corrosion.',
  'Volvo uses aluminum engine blocks and heads. Generic coolant can cause electrolysis, creating pinhole leaks in aluminum parts. Volvo OAT coolant maintains the correct pH to prevent this $2,000+ repair.',
  'normal'),

-- Cabin Air Filter (15K/1yr)
(2001, 2024, 'Volvo', 'S60',
  'Cabin Air Filter Replacement', 'filter_replacement',
  15000, 12,
  0.3, 'Volvo cabin air filter',
  'Replace yearly for clean air and efficient HVAC performance.',
  'Clogged filters reduce airflow by 50%, making the HVAC blower motor work 40% harder and risking premature failure ($350 repair). Fresh filters also remove 99% of pollen and pollutants.',
  'normal'),

-- Engine Air Filter (30K/2yr)
(2001, 2024, 'Volvo', 'S60',
  'Engine Air Filter Replacement', 'filter_replacement',
  30000, 24,
  0.3, 'Volvo engine air filter',
  'Clean air filters maintain engine power and fuel economy.',
  'Restricted airflow enriches the air-fuel mixture, reducing MPG by up to 10% and causing incomplete combustion. Turbo engines are especially sensitive - dirty filters reduce boost pressure and performance.',
  'normal'),

-- Spark Plugs (60K)
(2001, 2024, 'Volvo', 'S60',
  'Spark Plug Replacement', 'ignition_service',
  60000, NULL,
  1.5, '4 or 5 iridium spark plugs',
  'Fresh spark plugs maintain fuel economy and prevent catalytic converter damage.',
  'Worn plugs increase ignition gap, requiring higher voltage. Eventually, the coil cannot deliver enough voltage, causing misfires. Unburned fuel enters the catalytic converter, overheating it to 1,400°F+ and causing substrate meltdown ($1,800+ repair).',
  'normal'),

-- Differential Fluid (60K/4yr) - AWD models only
(2001, 2024, 'Volvo', 'S60',
  'Differential Fluid Service', 'differential_service',
  60000, 48,
  1.0, '1.5 quarts synthetic 75W-90 gear oil (AWD models)',
  'AWD S60s need differential service every 60,000 miles to prevent wear and noise.',
  'The Haldex AWD system''s rear differential operates under extreme pressure. Synthetic gear oil with EP additives forms a microscopically thin protective film that prevents metal-to-metal contact under 300,000 PSI loads.',
  'normal'),

-- Timing Belt - Only certain engines
(2001, 2009, 'Volvo', 'S60',
  'Timing Belt Replacement', 'belts_hoses',
  105000, NULL,
  4.0, 'Timing belt, tensioner, idler pulley, water pump',
  'Critical service - belt failure causes catastrophic engine damage on interference engines.',
  'Interference engines have valve-to-piston clearance of just 0.040". If the timing belt breaks, valves remain open as pistons reach top dead center, causing collision at high RPM. This bends valves, damages pistons, and can crack the cylinder head - $5,000-8,000 in repairs.',
  'normal'),

-- Tire Rotation (7.5K)
(2001, 2024, 'Volvo', 'S60',
  'Tire Rotation', 'tire_service',
  7500, NULL,
  0.5, 'None - rotation only',
  'Rotate tires every 7,500 miles to maximize tire life.',
  'FWD and AWD S60s wear front tires faster due to weight distribution and steering forces. Regular rotation equalizes wear, extending tire life by 25-30% (8,000-12,000 extra miles).',
  'normal'),

-- Brake Inspection (15K/1yr)
(2001, 2024, 'Volvo', 'S60',
  'Brake Inspection', 'brake_service',
  15000, 12,
  0.5, 'None - inspection only',
  'Annual brake checks prevent expensive rotor damage.',
  'Brake pads have a minimum safe thickness of 3mm. Worn pads expose the steel backing plate, which scores rotors, requiring replacement ($400 vs $250 for pads alone).',
  'normal'),

-- Battery Test (30K/2yr)
(2001, 2024, 'Volvo', 'S60',
  'Battery Test', 'battery_service',
  30000, 24,
  0.3, 'None - test only',
  'Test every 2 years to avoid being stranded.',
  'Load testing reveals weak cells before total failure. Cold weather reduces battery capacity - at 0°F, batteries deliver only 40% of rated cranking amps. Testing prevents the $150 tow truck call.',
  'normal');

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_maint_schedules_make_model ON maintenance_schedules(make, model);
CREATE INDEX IF NOT EXISTS idx_maint_schedules_year_range ON maintenance_schedules(year_start, year_end);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category);
CREATE INDEX IF NOT EXISTS idx_service_catalog_urgency ON service_catalog(urgency_level);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN maintenance_schedules.year_start IS 'First model year this schedule applies to';
COMMENT ON COLUMN maintenance_schedules.year_end IS 'Last model year this schedule applies to';
COMMENT ON COLUMN maintenance_schedules.interval_months IS 'Time-based interval (e.g., "every 6 months")';
COMMENT ON COLUMN maintenance_schedules.labor_hours IS 'Typical labor hours for cost estimation';
COMMENT ON COLUMN maintenance_schedules.customer_explanation IS 'Customer-facing explanation in plain language';
COMMENT ON COLUMN maintenance_schedules.why_it_matters IS 'Physics/engineering explanation of why this service is important';

COMMENT ON TABLE service_catalog IS 'Master reference of all service types with typical costs and explanations';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 017 (AI Service Advisor Schedules) completed successfully!';
  RAISE NOTICE 'Service catalog entries: %', (SELECT COUNT(*) FROM service_catalog);
  RAISE NOTICE 'Volvo maintenance schedules: %', (SELECT COUNT(*) FROM maintenance_schedules WHERE make = 'Volvo');
END $$;

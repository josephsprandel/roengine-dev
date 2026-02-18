#!/usr/bin/env python3
"""
Gemini Maintenance Schedule Extraction Pipeline

Queries unique powertrain configs from nhtsa_vehicle_taxonomy, prompts
Gemini Flash for OEM maintenance schedules, validates and loads into
the maintenance schedule database.

Usage:
    python3 gemini_extract_schedule.py --make VOLVO
    python3 gemini_extract_schedule.py --make VOLVO --dry-run
    python3 gemini_extract_schedule.py --make VOLVO --limit 1
    python3 gemini_extract_schedule.py --all
"""

import argparse
import json
import os
import re
import sys
import time
import traceback
from datetime import datetime
from difflib import SequenceMatcher

import psycopg2
import psycopg2.extras
import requests

# ============================================================================
# Configuration
# ============================================================================

DB_DSN = os.environ.get(
    "DATABASE_URL",
    "dbname=shopops3 user=shopops password=shopops_dev host=localhost port=5432",
)
GEMINI_API_KEY = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)
MAX_OUTPUT_TOKENS = 16384
TEMPERATURE = 0.1
RATE_LIMIT_DELAY = 1.5  # seconds between API calls

VALID_ACTION_TYPES = {
    "replace", "inspect", "check", "lubricate", "rotate",
    "clean", "reset", "adjust", "tighten_torque", "diagnose_test",
}
ACTION_TYPE_MAP = {
    "change": "replace",
    "flush": "replace",
    "service": "replace",
    "refill": "replace",
    "top_off": "check",
    "top off": "check",
    "examine": "inspect",
    "test": "diagnose_test",
    "measure": "check",
    "torque": "tighten_torque",
    "lube": "lubricate",
    "grease": "lubricate",
}

BRAND_INSTRUCTIONS = {
    "HONDA": (
        "\n9. This vehicle uses Honda Maintenance Minder. Describe the code system "
        "(A, B, sub-items 1-5) and what each code triggers. Use "
        'interval_type="algorithm_driven" with fallback intervals.'
    ),
    "ACURA": (
        "\n9. This vehicle uses Acura Maintenance Minder (same as Honda). Describe "
        "the code system (A, B, sub-items 1-5) and what each code triggers. Use "
        'interval_type="algorithm_driven" with fallback intervals.'
    ),
    "MERCEDES-BENZ": (
        "\n9. This vehicle uses Mercedes-Benz Flex Service. "
        "Set oem_procedure_code to 'Service A', 'Service B', or numbered codes "
        "(e.g. 'Service 3', 'Service 4'). Do NOT write lengthy Flex Service "
        "explanations in oem_description."
    ),
}

ITEM_CATEGORY_KEYWORDS = {
    "oil": "engine",
    "engine": "engine",
    "belt": "engine",
    "pcv": "engine",
    "valve": "engine",
    "timing": "engine",
    "spark": "ignition",
    "ignition": "ignition",
    "filter": "filters",
    "cabin": "filters",
    "brake fluid": "fluids",
    "brake": "brakes",
    "rotor": "brakes",
    "pad": "brakes",
    "drum": "brakes",
    "parking": "brakes",
    "coolant": "cooling",
    "radiator": "cooling",
    "transmission fluid": "fluids",
    "atf": "fluids",
    "differential": "fluids",
    "transfer case": "fluids",
    "power steering": "fluids",
    "fluid": "fluids",
    "tire": "tires_wheels",
    "wheel": "tires_wheels",
    "tpms": "tires_wheels",
    "steering": "steering_suspension",
    "suspension": "steering_suspension",
    "ball joint": "steering_suspension",
    "tie rod": "steering_suspension",
    "cv": "drivetrain",
    "propeller": "drivetrain",
    "drive shaft": "drivetrain",
    "axle": "drivetrain",
    "exhaust": "exhaust",
    "evap": "exhaust",
    "catalytic": "exhaust",
    "fuel": "fuel_system",
    "battery": "electrical",
    "light": "electrical",
    "lamp": "electrical",
    "horn": "electrical",
    "wiper": "hvac",
    "seat belt": "safety",
    "airbag": "safety",
    "door": "body",
    "sunroof": "body",
    "body": "body",
}


# ============================================================================
# Prompt builder
# ============================================================================


def build_prompt(config):
    """Build the Gemini prompt for a specific powertrain config."""
    make = config["make"]
    model = config["model"]
    year = config["year"]
    engine_code = config["engine_code"] or "unknown"
    displacement = config.get("displacement_liters")
    cylinder_count = config.get("cylinder_count")
    fuel_type = config.get("fuel_type") or "gasoline"
    forced_induction = config.get("forced_induction") or "na"
    transmission_type = config.get("transmission_type") or "automatic"
    drive_type = config.get("drive_type") or "fwd"

    disp_str = f"{displacement}L " if displacement else ""
    cyl_str = f"{cylinder_count}-cylinder " if cylinder_count else ""
    fi_str = f" {forced_induction}" if forced_induction not in ("na", "none", "") else ""
    fi_type = forced_induction if forced_induction not in ("na", "none", "") else "na"

    brand_extra = BRAND_INSTRUCTIONS.get(make.upper(), "")

    mercedes_concise = ""
    if make.upper() == "MERCEDES-BENZ":
        mercedes_concise = (
            "\n\nCRITICAL RESPONSE SIZE LIMIT — MERCEDES-BENZ:\n"
            "- For oem_description: use 10 words or fewer per item. No Flex Service explanations.\n"
            "- For severe_condition_description: always set to null.\n"
            "- For severe_use_conditions: use at most 2 entries.\n"
            "- For capacity_note: 3 words max (e.g. \"with filter\", \"drain only\").\n"
            "- Keep your ENTIRE JSON response under 6000 tokens. Be concise. "
            "Every field not listed above should still be populated normally."
        )

    prompt = f"""You are an automotive maintenance data extraction system. Return ONLY valid JSON, no markdown, no explanation, no code fences.

For a {year} {make} {model} with the {engine_code} engine ({disp_str}{cyl_str}{fuel_type}{fi_str}), {transmission_type} transmission, {drive_type.upper()} drivetrain:

Extract the COMPLETE OEM maintenance schedule. Include every maintenance item at every interval.

Return this exact JSON structure:
{{
  "vehicle": {{
    "make": "{make}",
    "model": "{model}",
    "year": {year},
    "market": "us",
    "schedule_paradigm": "fixed_interval"
  }},
  "powertrain": {{
    "engine_code": "{engine_code}",
    "engine_family": null,
    "displacement_liters": {displacement if displacement else 'null'},
    "cylinder_count": {cylinder_count if cylinder_count else 'null'},
    "cylinder_layout": null,
    "valve_train": null,
    "forced_induction_type": "{fi_type}",
    "fuel_type": "{fuel_type}",
    "horsepower": null,
    "torque_lb_ft": null,
    "redline_rpm": null,
    "compression_ratio": null,
    "transmission_code": null,
    "transmission_type": "{transmission_type}",
    "transmission_speeds": null,
    "drive_type": "{drive_type}",
    "has_transfer_case": false
  }},
  "fluid_specifications": [
    {{
      "fluid_type": "engine_oil",
      "capacity_liters": null,
      "capacity_quarts": null,
      "capacity_note": null,
      "fluid_spec": null,
      "fluid_spec_alt": null,
      "oem_part_number": null,
      "fluid_warning": null
    }}
  ],
  "schedule_entries": [
    {{
      "item_name": "Engine Oil",
      "action_type": "replace",
      "interval_type": "fixed_recurring",
      "interval_miles": 10000,
      "interval_months": 12,
      "severe_interval_miles": null,
      "severe_interval_months": null,
      "severe_use_conditions": [],
      "severe_condition_description": null,
      "initial_miles": null,
      "initial_months": null,
      "relative_item_name": null,
      "relative_multiplier": null,
      "fallback_interval_miles": null,
      "fallback_interval_months": null,
      "has_conditional_replacement": false,
      "conditional_replacement_note": null,
      "requires_equipment": [],
      "excludes_equipment": [],
      "applies_to_engine_codes": [],
      "applies_to_trans_codes": [],
      "applies_from_year": null,
      "applies_to_year": null,
      "severe_use_only": false,
      "requirement_level": "required",
      "warranty_class": null,
      "oem_description": "Replace engine oil and filter. Reset service reminder.",
      "oem_procedure_code": null,
      "service_code": null
    }}
  ]
}}

IMPORTANT: Return the COMPLETE maintenance schedule. A typical vehicle has 15-30 maintenance items. Include ALL of these categories:
- Engine: oil, oil filter, air filter, spark plugs, PCV valve
- Fluids: coolant, brake fluid, transmission fluid, differential fluid, power steering fluid
- Brakes: pad inspection, rotor inspection, brake fluid flush
- Tires: rotation, alignment check
- Cabin: cabin air filter, wiper blades
- Belts/hoses: serpentine/drive belt, coolant hoses inspection
- Electrical: battery check
- Suspension: inspection of bushings, ball joints, tie rods, steering linkage
- Exhaust: exhaust system inspection
- Safety: seat belts, exterior lighting, headlamps
- Drivetrain: transfer case fluid (4WD/AWD), differential fluid (AWD/RWD), CV joint boots, propeller shaft
If the vehicle has fewer than 12 maintenance items, you are likely missing something. Check again.

IMPORTANT INSTRUCTIONS:
1. Include ALL maintenance items at ALL intervals. Common items: Engine Oil, Engine Oil Filter, Spark Plugs, Air Filter Element, Cabin Air Filter, Brake Fluid, Coolant, Automatic Transmission Fluid, Differential Fluid, Drive Belt, Brake Pads, Brake Rotors, Tires (rotate), Wiper Blades, Battery, PCV Valve, Fuel Filter, Steering Components, Suspension Components, CV Joint Boots, Propeller Shaft, Exhaust System, Parking Brake, Seat Belts, Headlamps, Exterior Lighting.
2. Include BOTH normal and severe service intervals where applicable.
3. Action types must be one of: replace, inspect, check, lubricate, rotate, clean, reset, adjust, tighten_torque, diagnose_test
4. For fluid_specifications, include specific data for each fluid type:
   - fluid_spec: exact specification (e.g., "0W-20", "DOT 4+", "ATF WS", "Dexron VI", "75W-90")
   - capacity_quarts: exact capacity (e.g., 5.9 for oil with filter, 8.5 for coolant)
   - capacity_liters: same capacity in liters
   - capacity_note: "with filter", "drain and fill only", "total system", etc.
   - oem_part_number: if known
   Include all applicable fluids: engine_oil, coolant, atf, brake_fluid, differential_front, differential_rear, transfer_case, power_steering.
   Do not return empty fluid specifications. If you don't know the exact capacity, provide your best estimate and note the uncertainty in capacity_note.
5. Include equipment/option dependencies (e.g., "awd" in requires_equipment for AWD-only items).
6. Include the verbatim OEM description text for each item.
7. Include ALL fields from the schema even if null.
8. If you are not confident about a specific interval or specification, set the value to null and add a note in oem_description explaining your uncertainty. Do not guess.
9. For the oem_procedure_code field:
   - Honda/Acura: Set to the Maintenance Minder code: "A", "B", "1", "2", "3", "4", "5", "6"
   - Mercedes-Benz: Set to "Service A", "Service B", or numbered service codes like "Service 3", "Service 4", "Service 8", "Service 12"
   - BMW: Set to the CBS (Condition Based Service) item name if applicable
   - Toyota: Set to the service interval tier (e.g., "5K", "15K", "30K", "60K")
   - All others: Set to the OEM service code if the manufacturer uses a code-based system, otherwise null{mercedes_concise}{brand_extra}"""

    return prompt


# ============================================================================
# Extractor class
# ============================================================================


class GeminiScheduleExtractor:
    def __init__(self, db_dsn, api_key, dry_run=False):
        self.conn = psycopg2.connect(db_dsn)
        self.conn.autocommit = False
        self.api_key = api_key
        self.dry_run = dry_run

        # Caches
        self.items_cache = {}    # normalized_name -> item_id
        self.aliases_cache = {}  # normalized_alias -> item_id
        self.category_ids = {}   # category_name -> category_id

        self._load_maintenance_items()
        self._load_categories()
        self._load_validation_rules()

        # Stats
        self.stats = {
            "configs_processed": 0,
            "configs_skipped": 0,
            "total_entries": 0,
            "total_flagged": 0,
            "total_fluids": 0,
            "errors": 0,
            "start_time": time.time(),
        }

    # ------------------------------------------------------------------
    # Initialization helpers
    # ------------------------------------------------------------------

    def _load_maintenance_items(self):
        with self.conn.cursor() as cur:
            cur.execute("SELECT id, name, name_aliases FROM maintenance_items")
            for item_id, name, aliases in cur.fetchall():
                self.items_cache[name.lower().strip()] = item_id
                if aliases:
                    for alias in aliases:
                        self.aliases_cache[alias.lower().strip()] = item_id

    def _load_categories(self):
        with self.conn.cursor() as cur:
            cur.execute("SELECT id, name FROM maintenance_item_categories")
            for cat_id, name in cur.fetchall():
                self.category_ids[name] = cat_id

    def _load_validation_rules(self):
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT rule_name, applies_to_item_name, applies_to_action_type, "
                "min_interval_miles, max_interval_miles, "
                "min_interval_months, max_interval_months, severity "
                "FROM validation_rules WHERE is_active = TRUE"
            )
            self.validation_rules = [dict(r) for r in cur.fetchall()]

    # ------------------------------------------------------------------
    # Get pending configs
    # ------------------------------------------------------------------

    def get_pending_configs(self, make=None):
        """Return unique powertrain configs needing extraction."""
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            where = "schedule_status = 'pending'"
            params = []
            if make:
                where += " AND UPPER(make) = UPPER(%s)"
                params.append(make)

            cur.execute(
                f"""
                SELECT
                    engine_code,
                    displacement_liters,
                    cylinder_count,
                    fuel_type,
                    forced_induction,
                    transmission_type,
                    drive_type,
                    MIN(make) AS make,
                    (array_agg(model ORDER BY year DESC))[1] AS model,
                    (array_agg(year ORDER BY year DESC))[1] AS year,
                    COUNT(*) AS vehicle_count,
                    array_agg(DISTINCT id) AS taxonomy_ids
                FROM nhtsa_vehicle_taxonomy
                WHERE {where}
                GROUP BY engine_code, displacement_liters, cylinder_count,
                         fuel_type, forced_induction, transmission_type, drive_type
                ORDER BY engine_code
                """,
                params,
            )
            return [dict(r) for r in cur.fetchall()]

    # ------------------------------------------------------------------
    # Gemini API
    # ------------------------------------------------------------------

    def call_gemini(self, prompt, retries=2, max_tokens=None):
        """Send prompt to Gemini API and return (parsed_json, raw_text)."""
        url = f"{GEMINI_API_URL}?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": max_tokens or MAX_OUTPUT_TOKENS,
                "temperature": TEMPERATURE,
            },
        }

        max_http_retries = 5
        backoff_base = 2  # seconds

        last_error = None
        for attempt in range(1, retries + 1):
            # HTTP-level retry loop with exponential backoff for 429/500/503
            resp = None
            for http_attempt in range(max_http_retries):
                resp = requests.post(url, json=payload, timeout=120)
                if resp.status_code in (429, 500, 503):
                    wait_time = backoff_base * (2 ** http_attempt)
                    print(f"    HTTP {resp.status_code} (attempt {http_attempt + 1}/{max_http_retries}). "
                          f"Waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                break
            resp.raise_for_status()

            result = resp.json()

            try:
                text = result["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError) as e:
                raise ValueError(f"Unexpected Gemini response structure: {e}\n{json.dumps(result)[:500]}")

            try:
                return self._extract_json(text), text
            except (json.JSONDecodeError, ValueError) as e:
                last_error = e
                if attempt < retries:
                    print(f"    JSON parse failed (attempt {attempt}), retrying...")
                    time.sleep(2)
                    continue
                raise

        raise last_error

    @staticmethod
    def _extract_json(text):
        """Extract and parse JSON from Gemini response text."""
        # Strip markdown code fences
        clean = re.sub(r"```(?:json)?\s*", "", text).strip()

        # Find the outermost JSON object
        brace_start = clean.find("{")
        if brace_start == -1:
            raise ValueError(f"No JSON object found in response: {clean[:200]}...")

        depth = 0
        in_string = False
        escape_next = False
        for i in range(brace_start, len(clean)):
            c = clean[i]
            if escape_next:
                escape_next = False
                continue
            if c == "\\":
                escape_next = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    json_str = clean[brace_start : i + 1]
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError:
                        # Try fixing trailing commas
                        fixed = re.sub(r",\s*([}\]])", r"\1", json_str)
                        return json.loads(fixed)

        # Fallback: try parsing from brace_start to end
        json_str = clean[brace_start:]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            fixed = re.sub(r",\s*([}\]])", r"\1", json_str)
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                # Attempt truncated JSON repair
                repaired = GeminiScheduleExtractor._repair_truncated_json(json_str)
                if repaired:
                    print("    Repaired truncated JSON response")
                    return repaired
                raise

    @staticmethod
    def _repair_truncated_json(text):
        """Attempt to repair a JSON response that was truncated mid-stream.

        Strategy: find the last complete array element in schedule_entries or
        fluid_specifications, discard everything after it, and close all open
        brackets/braces.
        """
        # If we're inside a string, close it
        # Count unescaped quotes
        in_str = False
        escape = False
        for ch in text:
            if escape:
                escape = False
                continue
            if ch == '\\':
                escape = True
                continue
            if ch == '"':
                in_str = not in_str

        if in_str:
            # We're inside an unterminated string — truncate back to the
            # last complete JSON object boundary (closing brace before the
            # truncated entry).
            # Find the last "},\n" or "}\n" which marks end of a complete
            # array element.
            last_complete = text.rfind('},')
            if last_complete == -1:
                last_complete = text.rfind('}')
            if last_complete == -1:
                return None
            text = text[: last_complete + 1]

        # Now close any remaining open arrays/objects
        stack = []
        in_str = False
        escape = False
        for ch in text:
            if escape:
                escape = False
                continue
            if ch == '\\':
                escape = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch in ('{', '['):
                stack.append('}' if ch == '{' else ']')
            elif ch in ('}', ']'):
                if stack:
                    stack.pop()

        # Remove any trailing comma before we close
        text = text.rstrip()
        if text.endswith(','):
            text = text[:-1]

        # Close all remaining open structures
        closing = ''.join(reversed(stack))
        repaired_text = text + closing

        # Fix trailing commas that might be left inside
        repaired_text = re.sub(r',\s*([}\]])', r'\1', repaired_text)

        try:
            return json.loads(repaired_text)
        except json.JSONDecodeError:
            return None

    # ------------------------------------------------------------------
    # Item matching
    # ------------------------------------------------------------------

    def match_item(self, item_name):
        """Match an item name to maintenance_items, creating if no match."""
        if not item_name:
            return None

        normalized = item_name.lower().strip()

        # Exact match on name
        if normalized in self.items_cache:
            return self.items_cache[normalized]

        # Match on aliases
        if normalized in self.aliases_cache:
            return self.aliases_cache[normalized]

        # Fuzzy match
        best_id = None
        best_ratio = 0.0
        for name, item_id in self.items_cache.items():
            ratio = SequenceMatcher(None, normalized, name).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_id = item_id
        for alias, item_id in self.aliases_cache.items():
            ratio = SequenceMatcher(None, normalized, alias).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_id = item_id

        if best_ratio >= 0.80:
            self.items_cache[normalized] = best_id
            return best_id

        # No match — create new item
        return self._create_maintenance_item(item_name)

    def _create_maintenance_item(self, item_name):
        """Create a new maintenance item and return its id."""
        name_lower = item_name.lower()
        category = "engine"  # default
        for keyword, cat in ITEM_CATEGORY_KEYWORDS.items():
            if keyword in name_lower:
                category = cat
                break

        cat_id = self.category_ids.get(category, self.category_ids.get("engine", 1))

        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO maintenance_items (category_id, name, name_aliases, is_powertrain_dependent)
                VALUES (%s, %s, %s, TRUE)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                """,
                (cat_id, item_name, [item_name]),
            )
            item_id = cur.fetchone()[0]

        self.items_cache[item_name.lower().strip()] = item_id
        print(f"    + Created maintenance item: {item_name} (id={item_id}, cat={category})")
        return item_id

    # ------------------------------------------------------------------
    # Powertrain config
    # ------------------------------------------------------------------

    def find_or_create_powertrain_config(self, config, gemini_data):
        """Find or create a powertrain_configs row. Returns (config_id, is_existing)."""
        pt = gemini_data.get("powertrain", {})

        engine_code = config["engine_code"]
        drive_type = config.get("drive_type") or pt.get("drive_type") or "fwd"
        trans_code = pt.get("transmission_code")

        with self.conn.cursor() as cur:
            # Try to find existing config
            if trans_code:
                cur.execute(
                    "SELECT id FROM powertrain_configs "
                    "WHERE engine_code = %s AND transmission_code = %s AND drive_type = %s",
                    (engine_code, trans_code, drive_type),
                )
            else:
                cur.execute(
                    "SELECT id FROM powertrain_configs "
                    "WHERE engine_code = %s AND transmission_code IS NULL AND drive_type = %s",
                    (engine_code, drive_type),
                )

            row = cur.fetchone()
            if row:
                return row[0], True

            # Resolve values with fallbacks from both config and Gemini data
            displacement = config.get("displacement_liters") or pt.get("displacement_liters")
            cylinders = config.get("cylinder_count") or pt.get("cylinder_count")
            fuel = config.get("fuel_type") or pt.get("fuel_type") or "gasoline"
            fi = config.get("forced_induction") or "na"
            if fi in ("na", "none", ""):
                fi = pt.get("forced_induction_type") or "na"
            trans_type = config.get("transmission_type") or pt.get("transmission_type") or "automatic"
            layout = pt.get("cylinder_layout") or "inline"

            cur.execute(
                """
                INSERT INTO powertrain_configs (
                    engine_code, engine_family, displacement_liters, cylinder_count,
                    cylinder_layout, valve_train, forced_induction_type,
                    fuel_type, transmission_code, transmission_type, transmission_speeds,
                    drive_type, has_transfer_case, horsepower, torque_lb_ft,
                    redline_rpm, compression_ratio, oem_make
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s
                ) RETURNING id
                """,
                (
                    engine_code,
                    pt.get("engine_family"),
                    displacement,
                    cylinders,
                    layout,
                    pt.get("valve_train"),
                    fi,
                    fuel,
                    trans_code,
                    trans_type,
                    pt.get("transmission_speeds"),
                    drive_type,
                    pt.get("has_transfer_case", False),
                    pt.get("horsepower"),
                    pt.get("torque_lb_ft"),
                    pt.get("redline_rpm"),
                    pt.get("compression_ratio"),
                    config["make"],
                ),
            )
            return cur.fetchone()[0], False

    # ------------------------------------------------------------------
    # Schedule entries
    # ------------------------------------------------------------------

    def _normalize_action_type(self, raw):
        """Map a raw action type to a valid enum value."""
        if not raw:
            return "inspect"
        lower = raw.lower().strip()
        if lower in VALID_ACTION_TYPES:
            return lower
        return ACTION_TYPE_MAP.get(lower, "inspect")

    def _to_pg_array(self, val):
        """Convert a value to a Python list suitable for psycopg2 array adaptation, or None."""
        if val is None:
            return None
        if isinstance(val, list):
            return val if val else None
        return None

    def insert_schedule_entries(self, config_id, entries):
        """Insert maintenance_schedule rows. Returns (inserted, flagged)."""
        inserted = 0
        flagged = 0

        with self.conn.cursor() as cur:
            for entry in entries:
                item_name = entry.get("item_name")
                if not item_name:
                    continue

                item_id = self.match_item(item_name)
                if not item_id:
                    continue

                action_type = self._normalize_action_type(entry.get("action_type"))
                interval_type = entry.get("interval_type", "fixed_recurring")
                interval_miles = entry.get("interval_miles")
                interval_months = entry.get("interval_months")

                # Validate
                needs_review, review_notes, confidence = self._validate_entry(
                    item_name, action_type, interval_miles, interval_months
                )
                if needs_review:
                    flagged += 1

                # Handle relative_to_item
                relative_item_id = None
                if entry.get("relative_item_name"):
                    relative_item_id = self.match_item(entry["relative_item_name"])

                cur.execute(
                    """
                    INSERT INTO maintenance_schedules (
                        powertrain_config_id, maintenance_item_id,
                        action_type, interval_type,
                        interval_miles, interval_months,
                        severe_interval_miles, severe_interval_months,
                        severe_use_conditions, severe_condition_description,
                        initial_miles, initial_months,
                        relative_item_id, relative_multiplier,
                        fallback_interval_miles, fallback_interval_months,
                        has_conditional_replacement, conditional_replacement_note,
                        requires_equipment, excludes_equipment,
                        applies_to_engine_codes, applies_to_trans_codes,
                        applies_from_year, applies_to_year,
                        severe_use_only, requirement_level, warranty_class,
                        oem_description, oem_procedure_code,
                        data_source, data_confidence, needs_review, review_notes
                    ) VALUES (
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        'gemini_extracted', %s, %s, %s
                    )
                    """,
                    (
                        config_id,
                        item_id,
                        action_type,
                        interval_type,
                        interval_miles,
                        interval_months,
                        entry.get("severe_interval_miles"),
                        entry.get("severe_interval_months"),
                        self._to_pg_array(entry.get("severe_use_conditions")),
                        entry.get("severe_condition_description"),
                        entry.get("initial_miles"),
                        entry.get("initial_months"),
                        relative_item_id,
                        entry.get("relative_multiplier"),
                        entry.get("fallback_interval_miles"),
                        entry.get("fallback_interval_months"),
                        entry.get("has_conditional_replacement", False),
                        entry.get("conditional_replacement_note"),
                        self._to_pg_array(entry.get("requires_equipment")),
                        self._to_pg_array(entry.get("excludes_equipment")),
                        self._to_pg_array(entry.get("applies_to_engine_codes")),
                        self._to_pg_array(entry.get("applies_to_trans_codes")),
                        entry.get("applies_from_year"),
                        entry.get("applies_to_year"),
                        entry.get("severe_use_only", False),
                        entry.get("requirement_level", "required"),
                        entry.get("warranty_class"),
                        entry.get("oem_description"),
                        entry.get("oem_procedure_code"),
                        confidence,
                        needs_review,
                        review_notes,
                    ),
                )
                inserted += 1

        return inserted, flagged

    def _validate_entry(self, item_name, action_type, interval_miles, interval_months):
        """Validate against validation_rules. Returns (needs_review, notes, confidence)."""
        violations = []

        for rule in self.validation_rules:
            # Check applicability
            if rule["applies_to_item_name"] and rule["applies_to_item_name"] != item_name:
                # Also check fuzzy match on rule item name
                ratio = SequenceMatcher(
                    None, item_name.lower(), rule["applies_to_item_name"].lower()
                ).ratio()
                if ratio < 0.80:
                    continue
            if rule["applies_to_action_type"] and rule["applies_to_action_type"] != action_type:
                continue

            # Check mile bounds
            if (
                rule["min_interval_miles"]
                and interval_miles
                and interval_miles < rule["min_interval_miles"]
            ):
                violations.append(
                    f"{rule['rule_name']}: {interval_miles} mi < {rule['min_interval_miles']} mi min"
                )
            if (
                rule["max_interval_miles"]
                and interval_miles
                and interval_miles > rule["max_interval_miles"]
            ):
                violations.append(
                    f"{rule['rule_name']}: {interval_miles} mi > {rule['max_interval_miles']} mi max"
                )

        if violations:
            return True, "; ".join(violations), "low"
        return False, None, "high"

    # ------------------------------------------------------------------
    # Fluid specifications
    # ------------------------------------------------------------------

    def insert_fluid_specs(self, config_id, fluids):
        """Insert fluid_specifications rows. Returns count."""
        count = 0
        with self.conn.cursor() as cur:
            for fluid in fluids:
                fluid_type = fluid.get("fluid_type")
                if not fluid_type:
                    continue

                cur.execute(
                    """
                    INSERT INTO fluid_specifications (
                        powertrain_config_id, fluid_type,
                        capacity_liters, capacity_quarts, capacity_note,
                        fluid_spec, fluid_spec_alt, oem_part_number, fluid_warning
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (powertrain_config_id, fluid_type) DO UPDATE
                    SET fluid_spec = COALESCE(EXCLUDED.fluid_spec, fluid_specifications.fluid_spec),
                        capacity_liters = COALESCE(EXCLUDED.capacity_liters, fluid_specifications.capacity_liters),
                        capacity_quarts = COALESCE(EXCLUDED.capacity_quarts, fluid_specifications.capacity_quarts)
                    """,
                    (
                        config_id,
                        fluid_type,
                        fluid.get("capacity_liters"),
                        fluid.get("capacity_quarts"),
                        fluid.get("capacity_note"),
                        fluid.get("fluid_spec"),
                        fluid.get("fluid_spec_alt"),
                        fluid.get("oem_part_number"),
                        fluid.get("fluid_warning"),
                    ),
                )
                count += 1
        return count

    # ------------------------------------------------------------------
    # Vehicle applications
    # ------------------------------------------------------------------

    def create_vehicle_applications(self, config_id, taxonomy_ids, config):
        """Create vehicle_application rows from taxonomy IDs."""
        with self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT make, model, MIN(year) AS year_start, MAX(year) AS year_end
                FROM nhtsa_vehicle_taxonomy
                WHERE id = ANY(%s)
                GROUP BY make, model
                """,
                (taxonomy_ids,),
            )
            vehicles = cur.fetchall()

        with self.conn.cursor() as cur:
            for v in vehicles:
                cur.execute(
                    """
                    INSERT INTO vehicle_applications (
                        powertrain_config_id, make, model,
                        year_start, year_end, market, schedule_paradigm
                    ) VALUES (%s, %s, %s, %s, %s, 'us', 'fixed_interval')
                    ON CONFLICT DO NOTHING
                    """,
                    (config_id, v["make"], v["model"], v["year_start"], v["year_end"]),
                )

    # ------------------------------------------------------------------
    # Logging and status updates
    # ------------------------------------------------------------------

    def log_ingestion(
        self, config, prompt, raw_response, status,
        items_extracted, items_validated, items_flagged,
        config_id, is_duplicate, validation_notes=None,
    ):
        """Log to gemini_ingestion_log."""
        # Convert raw_response to JSON-safe value
        if isinstance(raw_response, (dict, list)):
            raw_json = psycopg2.extras.Json(raw_response)
        elif isinstance(raw_response, str):
            # Try to parse as JSON, otherwise wrap as string
            try:
                raw_json = psycopg2.extras.Json(json.loads(raw_response))
            except (json.JSONDecodeError, TypeError):
                raw_json = psycopg2.extras.Json({"raw_text": raw_response[:10000]})
        else:
            raw_json = psycopg2.extras.Json({"error": str(raw_response)})

        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO gemini_ingestion_log (
                    request_make, request_model, request_year, request_engine_code,
                    prompt_template, prompt_text, raw_response,
                    status, items_extracted, items_validated, items_flagged,
                    validation_notes, powertrain_config_id,
                    is_duplicate_config, processed_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """,
                (
                    config["make"],
                    config["model"],
                    config["year"],
                    config["engine_code"],
                    "v1_full_schedule",
                    prompt[:10000],
                    raw_json,
                    status,
                    items_extracted,
                    items_validated,
                    items_flagged,
                    validation_notes,
                    config_id,
                    is_duplicate,
                ),
            )

    def update_taxonomy_status(self, taxonomy_ids, config_id, status="extracted"):
        """Update nhtsa_vehicle_taxonomy for all vehicles matching this config."""
        with self.conn.cursor() as cur:
            cur.execute(
                """
                UPDATE nhtsa_vehicle_taxonomy
                SET schedule_status = %s, powertrain_config_id = %s
                WHERE id = ANY(%s) AND schedule_status = 'pending'
                """,
                (status, config_id, taxonomy_ids),
            )
            return cur.rowcount

    # ------------------------------------------------------------------
    # Main processing
    # ------------------------------------------------------------------

    def process_config(self, config, index, total):
        """Process a single powertrain config end-to-end."""
        engine_code = config["engine_code"]
        make = config["make"]
        model = config["model"]
        year = config["year"]
        drive = config.get("drive_type") or "?"
        trans = config.get("transmission_type") or "?"
        taxonomy_ids = config["taxonomy_ids"]

        print(
            f"\n[{index}/{total}] {make} {model} {year} -- {engine_code} "
            f"({drive}/{trans}) [{config['vehicle_count']} vehicles]"
        )

        # Build prompt
        prompt = build_prompt(config)

        if self.dry_run:
            print(f"  DRY RUN -- prompt length: {len(prompt)} chars, skipping API call")
            return

        # Call Gemini (reduced token budget for Mercedes to avoid truncation)
        max_tok = 8192 if config["make"].upper() == "MERCEDES-BENZ" else None
        try:
            gemini_data, raw_text = self.call_gemini(prompt, max_tokens=max_tok)
        except requests.exceptions.HTTPError as e:
            print(f"  HTTP ERROR: {e}")
            self.log_ingestion(
                config, prompt, str(e), "rejected", 0, 0, 0, None, False, str(e)
            )
            self.conn.commit()
            self.stats["errors"] += 1
            return
        except (ValueError, json.JSONDecodeError) as e:
            print(f"  JSON PARSE ERROR: {e}")
            self.log_ingestion(
                config, prompt, str(e), "rejected", 0, 0, 0, None, False, str(e)
            )
            self.conn.commit()
            self.stats["errors"] += 1
            return
        except Exception as e:
            print(f"  UNEXPECTED ERROR: {e}")
            traceback.print_exc()
            self.log_ingestion(
                config, prompt, str(e), "rejected", 0, 0, 0, None, False, str(e)
            )
            self.conn.commit()
            self.stats["errors"] += 1
            return

        # Parse response
        entries = gemini_data.get("schedule_entries", [])
        fluids = gemini_data.get("fluid_specifications", [])

        print(f"  Gemini returned {len(entries)} schedule entries, {len(fluids)} fluid specs")

        if not entries:
            print("  WARNING: No schedule entries returned -- flagging")
            self.log_ingestion(
                config, prompt, gemini_data, "flagged",
                0, 0, 0, None, False, "No entries returned",
            )
            self.update_taxonomy_status(taxonomy_ids, None, "skipped")
            self.conn.commit()
            self.stats["configs_skipped"] += 1
            return

        # Find or create powertrain config
        try:
            config_id, is_existing = self.find_or_create_powertrain_config(config, gemini_data)
        except psycopg2.Error as e:
            print(f"  DB ERROR creating powertrain config: {e}")
            self.conn.rollback()
            self.stats["errors"] += 1
            return

        print(f"  Powertrain config id={config_id} ({'existing' if is_existing else 'new'})")

        # Insert schedule entries
        try:
            inserted, flagged_count = self.insert_schedule_entries(config_id, entries)
        except psycopg2.Error as e:
            print(f"  DB ERROR inserting schedules: {e}")
            self.conn.rollback()
            self.stats["errors"] += 1
            return

        print(f"  Inserted {inserted} schedule entries ({flagged_count} flagged)")

        # Insert fluid specs
        fluid_count = self.insert_fluid_specs(config_id, fluids)
        print(f"  Inserted {fluid_count} fluid specifications")

        # Create vehicle applications
        self.create_vehicle_applications(config_id, taxonomy_ids, config)

        # Update taxonomy status
        updated = self.update_taxonomy_status(taxonomy_ids, config_id)
        print(f"  Updated {updated} taxonomy entries -> 'extracted'")

        # Log ingestion
        self.log_ingestion(
            config, prompt, gemini_data, "loaded",
            len(entries), inserted, flagged_count,
            config_id, is_existing,
            f"Flagged: {flagged_count}" if flagged_count else None,
        )

        # Commit transaction
        self.conn.commit()

        # Update stats
        self.stats["configs_processed"] += 1
        self.stats["total_entries"] += inserted
        self.stats["total_flagged"] += flagged_count
        self.stats["total_fluids"] += fluid_count

    def run(self, make=None, limit=None):
        """Main entry point."""
        print("=" * 60)
        print("Gemini Maintenance Schedule Extraction Pipeline")
        print("=" * 60)
        print(f"Target:    {make or 'ALL makes'}")
        print(f"Model:     {GEMINI_MODEL}")
        print(f"Dry run:   {self.dry_run}")
        print(f"Limit:     {limit or 'none'}")
        print("=" * 60)

        configs = self.get_pending_configs(make)
        total = len(configs)
        print(f"\nFound {total} unique powertrain configs to process")

        if limit:
            configs = configs[:limit]
            total_to_run = len(configs)
            print(f"Limited to {total_to_run} configs")
        else:
            total_to_run = total

        if total_to_run == 0:
            print("Nothing to do!")
            return

        for i, config in enumerate(configs, 1):
            try:
                self.process_config(config, i, total_to_run)
            except Exception as e:
                print(f"  FATAL ERROR processing config: {e}")
                traceback.print_exc()
                try:
                    self.conn.rollback()
                except Exception:
                    pass
                self.stats["errors"] += 1

            # Rate limit between API calls
            if not self.dry_run and i < total_to_run:
                time.sleep(RATE_LIMIT_DELAY)

        # Final stats
        elapsed = time.time() - self.stats["start_time"]
        print(f"\n{'=' * 60}")
        print("EXTRACTION COMPLETE")
        print(f"{'=' * 60}")
        print(f"Configs processed: {self.stats['configs_processed']}")
        print(f"Configs skipped:   {self.stats['configs_skipped']}")
        print(f"Errors:            {self.stats['errors']}")
        print(f"Total entries:     {self.stats['total_entries']}")
        print(f"Total flagged:     {self.stats['total_flagged']}")
        print(f"Total fluid specs: {self.stats['total_fluids']}")
        print(f"Elapsed time:      {elapsed:.1f}s ({elapsed / 60:.1f} min)")
        if self.stats["configs_processed"] > 0:
            print(f"Avg per config:    {elapsed / self.stats['configs_processed']:.1f}s")
        print(f"{'=' * 60}")


# ============================================================================
# CLI entry point
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Extract OEM maintenance schedules via Gemini Flash"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--make", help="Process a specific make (e.g., VOLVO)")
    group.add_argument("--all", action="store_true", help="Process all pending makes")

    parser.add_argument("--dry-run", action="store_true", help="Build prompts but don't call Gemini")
    parser.add_argument("--limit", type=int, help="Limit number of configs to process")

    args = parser.parse_args()

    if not GEMINI_API_KEY:
        print("ERROR: Set GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable")
        sys.exit(1)

    make_filter = None if args.all else args.make

    extractor = GeminiScheduleExtractor(
        db_dsn=DB_DSN,
        api_key=GEMINI_API_KEY,
        dry_run=args.dry_run,
    )

    try:
        extractor.run(make=make_filter, limit=args.limit)
    finally:
        extractor.conn.close()


if __name__ == "__main__":
    main()

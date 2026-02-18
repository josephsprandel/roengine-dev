#!/usr/bin/env python3
"""
Test Batch Extraction — 20 diverse configs through Gemini pipeline.

Picks one matching config per test case from nhtsa_vehicle_taxonomy.
Inserts synthetic taxonomy rows for vehicles not already in the DB.
Calls process_config() from the main extraction script for each.

Usage:
    python3 test_batch_extract.py
    python3 test_batch_extract.py --dry-run
"""

import os
import sys
import time

import psycopg2
import psycopg2.extras

# Import the extractor from the main script (same directory)
sys.path.insert(0, os.path.dirname(__file__))
from gemini_extract_schedule import (
    DB_DSN,
    GEMINI_API_KEY,
    RATE_LIMIT_DELAY,
    GeminiScheduleExtractor,
)

# ============================================================================
# 20 Test Cases
# ============================================================================
# Each test case has:
#   - search patterns (make, model ILIKE, engine_code ILIKE)
#   - fallback: synthetic row to INSERT if no pending match found
#   - desc: human label for output

TEST_CASES = [
    {
        "desc": "1. BMW I6 Turbo (B58/N55)",
        "make": "BMW",
        "model_pattern": "%3%",
        "engine_pattern": "%I6%3.0%Turbo%",
        "fallback": {
            "make": "BMW", "model": "330i", "year": 2020,
            "engine_code": "I6 3.0L Turbo", "displacement_liters": 3.0,
            "cylinder_count": 6, "fuel_type": "gasoline",
            "forced_induction": "turbo", "transmission_type": "automatic",
            "drive_type": "RWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "2. BMW V8 Turbo (N63/S63)",
        "make": "BMW",
        "model_pattern": "%5%",
        "engine_pattern": "%V8%4.4%Turbo%",
        "fallback": {
            "make": "BMW", "model": "550i", "year": 2019,
            "engine_code": "V8 4.4L Turbo", "displacement_liters": 4.4,
            "cylinder_count": 8, "fuel_type": "gasoline",
            "forced_induction": "twin_turbo", "transmission_type": "automatic",
            "drive_type": "RWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "3. Honda Accord V6 (Maintenance Minder)",
        "make": "HONDA",
        "model_pattern": "%Accord%",
        "engine_pattern": "%V6%",
        "fallback": {
            "make": "HONDA", "model": "Accord", "year": 2017,
            "engine_code": "V6 3.5L", "displacement_liters": 3.5,
            "cylinder_count": 6, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "automatic",
            "drive_type": "FWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "4. Honda Civic I4 (Maintenance Minder)",
        "make": "HONDA",
        "model_pattern": "%Civic%",
        "engine_pattern": "%I4%",
        "fallback": {
            "make": "HONDA", "model": "Civic", "year": 2022,
            "engine_code": "I4 2.0L", "displacement_liters": 2.0,
            "cylinder_count": 4, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "cvt",
            "drive_type": "FWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "5. Mercedes M256 (Flex Service)",
        "make": "MERCEDES-BENZ",
        "model_pattern": "%",
        "engine_pattern": "%M256%",
        "fallback": {
            "make": "MERCEDES-BENZ", "model": "E450", "year": 2021,
            "engine_code": "M256", "displacement_liters": 3.0,
            "cylinder_count": 6, "fuel_type": "gasoline",
            "forced_induction": "turbo", "transmission_type": "automatic",
            "drive_type": "RWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "6. Mercedes V8 5.5T (Service A/B)",
        "make": "MERCEDES-BENZ",
        "model_pattern": "%",
        "engine_pattern": "%V8%5.5%Turbo%",
        "fallback": {
            "make": "MERCEDES-BENZ", "model": "S63 AMG", "year": 2016,
            "engine_code": "V8 5.5L Turbo", "displacement_liters": 5.5,
            "cylinder_count": 8, "fuel_type": "gasoline",
            "forced_induction": "twin_turbo", "transmission_type": "automatic",
            "drive_type": "RWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "7. Toyota Camry V6",
        "make": "TOYOTA",
        "model_pattern": "%Camry%",
        "engine_pattern": "%V6%",
        "fallback": {
            "make": "TOYOTA", "model": "Camry", "year": 2020,
            "engine_code": "V6 3.5L", "displacement_liters": 3.5,
            "cylinder_count": 6, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "automatic",
            "drive_type": "FWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "8. Toyota Tacoma (truck)",
        "make": "TOYOTA",
        "model_pattern": "%Tacoma%",
        "engine_pattern": "%",
        "fallback": {
            "make": "TOYOTA", "model": "Tacoma", "year": 2021,
            "engine_code": "V6 3.5L", "displacement_liters": 3.5,
            "cylinder_count": 6, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "automatic",
            "drive_type": "4WD", "vehicle_type": "TRUCK",
        },
    },
    {
        "desc": "9. Mazda RX-8 (rotary)",
        "make": "MAZDA",
        "model_pattern": "%RX%",
        "engine_pattern": "%",
        "fallback": {
            "make": "MAZDA", "model": "RX-8", "year": 2010,
            "engine_code": "R2 1.3L Rotary", "displacement_liters": 1.3,
            "cylinder_count": 2, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "manual",
            "drive_type": "RWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "10. Subaru H4 Boxer AWD",
        "make": "SUBARU",
        "model_pattern": "%",
        "engine_pattern": "%H4%",
        "fallback": {
            "make": "SUBARU", "model": "Outback", "year": 2021,
            "engine_code": "H4 2.5L", "displacement_liters": 2.5,
            "cylinder_count": 4, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "cvt",
            "drive_type": "AWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "11. Ford F-150 V8 5.0 (truck)",
        "make": "FORD",
        "model_pattern": "%F-150%",
        "engine_pattern": "%V8%5.0%",
        "fallback": {
            "make": "FORD", "model": "F-150", "year": 2021,
            "engine_code": "V8 5.0L", "displacement_liters": 5.0,
            "cylinder_count": 8, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "automatic",
            "drive_type": "4WD", "vehicle_type": "TRUCK",
        },
    },
    {
        "desc": "12. Jeep Wrangler (4WD)",
        "make": "JEEP",
        "model_pattern": "%Wrangler%",
        "engine_pattern": "%",
        "fallback": {
            "make": "JEEP", "model": "Wrangler", "year": 2021,
            "engine_code": "V6 3.6L", "displacement_liters": 3.6,
            "cylinder_count": 6, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "automatic",
            "drive_type": "4WD", "vehicle_type": "TRUCK",
        },
    },
    {
        "desc": "13. Ram 1500 Hemi V8",
        "make": "RAM",
        "model_pattern": "%1500%",
        "engine_pattern": "%V8%",
        "fallback": {
            "make": "RAM", "model": "1500", "year": 2021,
            "engine_code": "V8 5.7L", "displacement_liters": 5.7,
            "cylinder_count": 8, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "automatic",
            "drive_type": "4WD", "vehicle_type": "TRUCK",
        },
    },
    {
        "desc": "14. Hyundai T-GDI Theta II",
        "make": "HYUNDAI",
        "model_pattern": "%",
        "engine_pattern": "%I4%2.0%Turbo%",
        "fallback": {
            "make": "HYUNDAI", "model": "Sonata", "year": 2021,
            "engine_code": "I4 2.0L Turbo", "displacement_liters": 2.0,
            "cylinder_count": 4, "fuel_type": "gasoline",
            "forced_induction": "turbo", "transmission_type": "automatic",
            "drive_type": "FWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "15. Nissan VQ V6",
        "make": "NISSAN",
        "model_pattern": "%",
        "engine_pattern": "%V6%3.5%",
        "fallback": {
            "make": "NISSAN", "model": "Maxima", "year": 2020,
            "engine_code": "V6 3.5L", "displacement_liters": 3.5,
            "cylinder_count": 6, "fuel_type": "gasoline",
            "forced_induction": "na", "transmission_type": "cvt",
            "drive_type": "FWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "16. Audi TFSI Turbo",
        "make": "AUDI",
        "model_pattern": "%",
        "engine_pattern": "%I4%2.0%Turbo%",
        "fallback": {
            "make": "AUDI", "model": "A4", "year": 2021,
            "engine_code": "I4 2.0L Turbo", "displacement_liters": 2.0,
            "cylinder_count": 4, "fuel_type": "gasoline",
            "forced_induction": "turbo", "transmission_type": "automatic",
            "drive_type": "AWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "17. Toyota Prius (hybrid)",
        "make": "TOYOTA",
        "model_pattern": "%Prius%",
        "engine_pattern": "%",
        "fallback": {
            "make": "TOYOTA", "model": "Prius", "year": 2022,
            "engine_code": "I4 1.8L Hybrid", "displacement_liters": 1.8,
            "cylinder_count": 4, "fuel_type": "hybrid",
            "forced_induction": "na", "transmission_type": "cvt",
            "drive_type": "FWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "18. Diesel with DEF",
        "make": "FORD",
        "model_pattern": "%F-250%",
        "engine_pattern": "%diesel%",
        "alt_engine_patterns": ["%Diesel%", "%6.7%", "%Powerstroke%"],
        "fallback": {
            "make": "FORD", "model": "F-250 Super Duty", "year": 2021,
            "engine_code": "V8 6.7L Turbodiesel", "displacement_liters": 6.7,
            "cylinder_count": 8, "fuel_type": "diesel",
            "forced_induction": "turbo", "transmission_type": "automatic",
            "drive_type": "4WD", "vehicle_type": "TRUCK",
        },
    },
    {
        "desc": "19. Tesla EV (minimal schedule)",
        "make": "TESLA",
        "model_pattern": "%",
        "engine_pattern": "%",
        "fallback": {
            "make": "TESLA", "model": "Model 3", "year": 2023,
            "engine_code": "Electric", "displacement_liters": None,
            "cylinder_count": 0, "fuel_type": "electric",
            "forced_induction": "na", "transmission_type": "automatic",
            "drive_type": "AWD", "vehicle_type": "PASSENGER CAR",
        },
    },
    {
        "desc": "20. VW TDI Diesel",
        "make": "VOLKSWAGEN",
        "model_pattern": "%",
        "engine_pattern": "%TDI%",
        "alt_engine_patterns": ["%diesel%", "%2.0%diesel%"],
        "fallback": {
            "make": "VOLKSWAGEN", "model": "Jetta", "year": 2014,
            "engine_code": "I4 2.0L TDI", "displacement_liters": 2.0,
            "cylinder_count": 4, "fuel_type": "diesel",
            "forced_induction": "turbo", "transmission_type": "automatic",
            "drive_type": "FWD", "vehicle_type": "PASSENGER CAR",
        },
    },
]


# ============================================================================
# Helpers
# ============================================================================


def find_pending_config(conn, tc):
    """Search taxonomy for a pending config matching this test case.

    Returns a config dict compatible with process_config(), or None.
    Tries progressively broader patterns.
    """
    patterns_to_try = [
        # Attempt 1: exact make + model + engine
        (tc["make"], tc["model_pattern"], tc["engine_pattern"]),
        # Attempt 2: exact make + any model + engine
        (tc["make"], "%", tc["engine_pattern"]),
    ]

    # Add alt engine patterns
    for alt in tc.get("alt_engine_patterns", []):
        patterns_to_try.append((tc["make"], tc["model_pattern"], alt))
        patterns_to_try.append((tc["make"], "%", alt))

    # Attempt 3: broadest — make + any model + any engine (only for niche makes)
    if tc["make"] in ("TESLA", "MAZDA"):
        patterns_to_try.append((tc["make"], tc["model_pattern"], "%"))

    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        for make_val, model_pat, engine_pat in patterns_to_try:
            where_parts = ["schedule_status = 'pending'"]
            params = []

            if make_val != "%":
                where_parts.append("UPPER(make) = UPPER(%s)")
                params.append(make_val)

            if model_pat != "%":
                where_parts.append("model ILIKE %s")
                params.append(model_pat)

            if engine_pat != "%":
                where_parts.append("engine_code ILIKE %s")
                params.append(engine_pat)

            where = " AND ".join(where_parts)

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
                ORDER BY COUNT(*) DESC
                LIMIT 1
                """,
                params,
            )
            row = cur.fetchone()
            if row:
                return dict(row)

    return None


def insert_synthetic_taxonomy(conn, fallback):
    """Insert a synthetic taxonomy row and return its id."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO nhtsa_vehicle_taxonomy
                (make, model, year, engine_code, displacement_liters,
                 cylinder_count, fuel_type, forced_induction,
                 transmission_type, drive_type, vehicle_type,
                 schedule_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
            RETURNING id
            """,
            (
                fallback["make"],
                fallback["model"],
                fallback["year"],
                fallback["engine_code"],
                fallback.get("displacement_liters"),
                fallback.get("cylinder_count"),
                fallback.get("fuel_type", "gasoline"),
                fallback.get("forced_induction", "na"),
                fallback.get("transmission_type", "automatic"),
                fallback.get("drive_type", "FWD"),
                fallback.get("vehicle_type", "PASSENGER CAR"),
            ),
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return new_id


def build_config_from_fallback(fallback, taxonomy_id):
    """Build a config dict compatible with process_config() from fallback data."""
    return {
        "engine_code": fallback["engine_code"],
        "displacement_liters": fallback.get("displacement_liters"),
        "cylinder_count": fallback.get("cylinder_count"),
        "fuel_type": fallback.get("fuel_type", "gasoline"),
        "forced_induction": fallback.get("forced_induction", "na"),
        "transmission_type": fallback.get("transmission_type", "automatic"),
        "drive_type": fallback.get("drive_type", "FWD"),
        "make": fallback["make"],
        "model": fallback["model"],
        "year": fallback["year"],
        "vehicle_count": 1,
        "taxonomy_ids": [taxonomy_id],
    }


# ============================================================================
# Main
# ============================================================================


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Test batch: 20 diverse configs")
    parser.add_argument("--dry-run", action="store_true", help="Build prompts only")
    args = parser.parse_args()

    if not GEMINI_API_KEY:
        print("ERROR: Set GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable")
        sys.exit(1)

    extractor = GeminiScheduleExtractor(
        db_dsn=DB_DSN,
        api_key=GEMINI_API_KEY,
        dry_run=args.dry_run,
    )

    total = len(TEST_CASES)
    synthetic_count = 0
    results = []

    print("=" * 70)
    print("TEST BATCH EXTRACTION — 20 Diverse Configs")
    print("=" * 70)
    print()

    for i, tc in enumerate(TEST_CASES, 1):
        desc = tc["desc"]
        print(f"\n{'─' * 70}")
        print(f"[{i}/{total}] {desc}")
        print(f"  Search: make={tc['make']} model={tc['model_pattern']} engine={tc['engine_pattern']}")

        # Count maintenance items before processing
        with extractor.conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM maintenance_items")
            items_before = cur.fetchone()[0]

        # Try to find a matching pending config
        config = find_pending_config(extractor.conn, tc)

        if config:
            print(f"  Found:  {config['year']} {config['make']} {config['model']} -- "
                  f"{config['engine_code']} ({config.get('drive_type', '?')}/{config.get('transmission_type', '?')}) "
                  f"[{config['vehicle_count']} vehicles]")
            source = "taxonomy"
        else:
            print(f"  No match — inserting synthetic taxonomy row")
            fb = tc["fallback"]
            new_id = insert_synthetic_taxonomy(extractor.conn, fb)
            config = build_config_from_fallback(fb, new_id)
            synthetic_count += 1
            print(f"  Synthetic: {fb['year']} {fb['make']} {fb['model']} -- "
                  f"{fb['engine_code']} (id={new_id})")
            source = "synthetic"

        # Process through the extraction pipeline
        stats_before = dict(extractor.stats)
        try:
            extractor.process_config(config, i, total)
        except Exception as e:
            print(f"  FATAL ERROR: {e}")
            try:
                extractor.conn.rollback()
            except Exception:
                pass
            results.append({
                "desc": desc,
                "status": "ERROR",
                "engine_code": config.get("engine_code"),
                "make_model_year": f"{config['make']} {config['model']} {config['year']}",
                "entries": 0,
                "flagged": 0,
                "new_items": 0,
                "source": source,
                "error": str(e),
            })
            continue

        # Count maintenance items after
        with extractor.conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM maintenance_items")
            items_after = cur.fetchone()[0]

        new_items = items_after - items_before
        entries = extractor.stats["total_entries"] - stats_before["total_entries"]
        flagged = extractor.stats["total_flagged"] - stats_before["total_flagged"]
        fluids = extractor.stats["total_fluids"] - stats_before["total_fluids"]
        errored = extractor.stats["errors"] - stats_before["errors"]

        status = "ERROR" if errored else "LOADED"
        if args.dry_run:
            status = "DRY_RUN"

        results.append({
            "desc": desc,
            "status": status,
            "engine_code": config.get("engine_code"),
            "make_model_year": f"{config['make']} {config['model']} {config['year']}",
            "entries": entries,
            "fluids": fluids,
            "flagged": flagged,
            "new_items": new_items,
            "source": source,
        })

        print(f"  Result: {entries} entries, {fluids} fluids, {flagged} flagged, {new_items} new items — {status}")

        # Rate limit
        if not args.dry_run and i < total:
            time.sleep(RATE_LIMIT_DELAY)

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n\n{'=' * 70}")
    print("TEST BATCH SUMMARY")
    print(f"{'=' * 70}")

    loaded = sum(1 for r in results if r["status"] == "LOADED")
    errors = sum(1 for r in results if r["status"] == "ERROR")
    dry_runs = sum(1 for r in results if r["status"] == "DRY_RUN")
    total_entries = sum(r.get("entries", 0) for r in results)
    total_flagged = sum(r.get("flagged", 0) for r in results)
    total_new_items = sum(r.get("new_items", 0) for r in results)

    print(f"  Processed:       {loaded}/{total} loaded, {errors} errors, {dry_runs} dry-run")
    print(f"  Synthetic rows:  {synthetic_count}")
    print(f"  Total entries:   {total_entries}")
    print(f"  Total flagged:   {total_flagged}")
    print(f"  New items:       {total_new_items}")
    print()

    # Per-config detail table
    print(f"{'No':>3} {'Status':<8} {'Src':<5} {'Entries':>7} {'Flag':>4} {'New':>3}  {'Engine Code':<25} {'Vehicle'}")
    print(f"{'─' * 3} {'─' * 8} {'─' * 5} {'─' * 7} {'─' * 4} {'─' * 3}  {'─' * 25} {'─' * 30}")
    for j, r in enumerate(results, 1):
        src = "syn" if r["source"] == "synthetic" else "tax"
        print(
            f"{j:>3} {r['status']:<8} {src:<5} {r.get('entries', 0):>7} "
            f"{r.get('flagged', 0):>4} {r.get('new_items', 0):>3}  "
            f"{(r.get('engine_code') or '?'):<25} {r.get('make_model_year', '?')}"
        )

    print(f"\n{'=' * 70}")
    print("Done. Review results above, then run spot-check queries.")
    print(f"{'=' * 70}")

    extractor.conn.close()


if __name__ == "__main__":
    main()

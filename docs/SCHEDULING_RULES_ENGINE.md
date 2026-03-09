# AutoHouse Automotive — Scheduling Rules Engine Design Brief
**RO Engine | Claude Code Context Document**
*Based on ShopWare closed sales data: Jan 2023 – Dec 2025 | 4,225 revenue-producing ROs | $3.27M total revenue*
---
## Quick Reference: Critical Numbers
| Metric | Value | Use In Code |
|--------|-------|-------------|
| Avg ROs/business day | 5.6 (median: 5) | Default daily slot count |
| Hard daily RO ceiling | 7–9 | `MAX_DAILY_APPOINTMENTS = 9` |
| Avg tech hours/day (closing) | 15.5 hrs | Misleading — see capacity note below |
| **True production capacity** | **~16 hrs/day** | `DAILY_TECH_HOUR_CEILING = 16` |
| Avg weekly revenue | $20,810 | Baseline for week health scoring |
| Overall ARO | $774 | Baseline for ticket scoring |
| Waiter ARO | $295 | Weight in slot value calc |
| Drop-off ARO | $947 | Weight in slot value calc |
| Optimal waiter % per week | 10–20% | `TARGET_WAITER_RATIO = 0.15` |
| Week-killer frequency | 40% of all weeks | Not an edge case — routine constraint |
| No-show rate | ~2.75/month | Too low to overbooking-hedge |
---
## Capacity Model
### The Two-Tech Rule
**Les Baker and Nicholas Adams Sr. are 73% of all production hours.**
Do NOT model capacity as `num_techs * 8`. Model it as:
```
LEAD_TECH_CAPACITY_PER_DAY = 16  # hours (2 lead techs × 8 hrs)
SUPPORT_TECH_CAPACITY = 8        # Nick Adams Jr. + Joe Sprandel combined
TOTAL_DAILY_CEILING = 24         # absolute max, never schedulable to full
BOOKABLE_DAILY_HOURS = 16        # use this for scheduling decisions
```
When either Baker or Adams Sr. is marked absent:
```
REDUCED_CAPACITY_FACTOR = 0.60   # drop ceiling to ~10 hrs/day
```
### Tech Hour Bins → Days-in-Shop (Empirical)
Use these when estimating job duration at booking time:
```python
DURATION_ESTIMATES = {
    "0-2":  {"avg_days": 1.8,  "multiday_pct": 0.40},
    "2-4":  {"avg_days": 4.1,  "multiday_pct": 0.72},
    "4-6":  {"avg_days": 6.2,  "multiday_pct": 0.90},  # ← 90% go multi-day
    "6-8":  {"avg_days": 6.8,  "multiday_pct": 0.95},
    "8-10": {"avg_days": 7.5,  "multiday_pct": 0.98},
    "10-15":{"avg_days": 11.9, "multiday_pct": 0.99},
    "15-20":{"avg_days": 24.2, "multiday_pct": 1.00},  # ← week-killer
    "20+":  {"avg_days": 25.0, "multiday_pct": 1.00},  # ← week-killer
}
```
**Key threshold: 5 hours.** Any job estimated at ≥5 tech hours has >90% probability of becoming multi-day. Trigger bay hold at this threshold.
---
## Scheduling Rules
All rules use three enforcement levels:
- `HARD_BLOCK` — system prevents booking, requires manager override
- `SOFT_WARN` — system alerts SA (Bailey), she can override with reason
- `TRACK` — permitted, logged for analytics
### Rule Definitions
```python
SCHEDULING_RULES = [
    {
        "id": "R01",
        "name": "week_killer_weekly_limit",
        "description": "Max 2 jobs estimated >8 tech hours per week",
        "enforcement": "HARD_BLOCK",
        "trigger": "labor_estimate_hours > 8 AND week_big_job_count >= 2",
        "data_basis": "Top revenue weeks had 3-4 large jobs spread across full week; stacking 3+ simultaneously causes chaos without revenue upside",
    },
    {
        "id": "R02",
        "name": "bay_hold_on_large_job",
        "description": "≥5 tech hour job triggers Bay Hold + reduces weekly drop-off slots by 3",
        "enforcement": "HARD_BLOCK",
        "trigger": "labor_estimate_hours >= 5",
        "action": "set bay_hold=True, reduce week_available_dropoff_slots by 3",
        "data_basis": "90.1% of 5-hr jobs become multi-day; they consume bay and lead tech invisibly",
    },
    {
        "id": "R03",
        "name": "max_waiters_per_day",
        "description": "Maximum 2 Waiter appointments per business day",
        "enforcement": "SOFT_WARN",
        "trigger": "appointment_type == 'Waiter' AND day_waiter_count >= 2",
        "data_basis": "Weeks >30% waiter mix average $7k lower weekly revenue; Waiter ARO ($295) vs Drop-Off ($947)",
    },
    {
        "id": "R04",
        "name": "daily_appointment_ceiling",
        "description": "Maximum 9 total appointments per business day",
        "enforcement": "HARD_BLOCK",
        "trigger": "day_total_appointments >= 9",
        "note": "Current rule-of-thumb is 6 — data shows 7-9 RO days outperform on ARO. Raise ceiling but enforce hard at 9.",
        "data_basis": "Days with 11-15 ROs avg $997 ARO; days with 5-6 ROs avg $771. Volume does not compress ARO.",
    },
    {
        "id": "R05",
        "name": "friday_protection",
        "description": "Friday max 2 NEW appointments. No large drop-offs (>4 hrs) may START on Friday.",
        "enforcement": "HARD_BLOCK",
        "trigger": "(appointment_day == 'Friday' AND day_new_appointments >= 2) OR (appointment_day == 'Friday' AND labor_estimate_hours > 4)",
        "data_basis": "Friday closes 1,098 ROs at $957 avg ARO — driven by completing week's multi-day work, not new intake",
    },
    {
        "id": "R06",
        "name": "chevy_truck_flag",
        "description": "Chevrolet truck/SUV (Silverado, Tahoe, Suburban, Traverse) + major repair = require estimate before confirming",
        "enforcement": "SOFT_WARN",
        "trigger": "vehicle_make == 'Chevrolet' AND vehicle_model IN ['Silverado', 'Silverado 1500', 'Silverado 2500', 'Tahoe', 'Suburban', 'Traverse'] AND job_type IN ['engine', 'transmission', 'drivetrain', 'major_repair', 'unknown']",
        "action": "Block confirmation, prompt Bailey for labor estimate",
        "data_basis": "Chevrolet generates 28 big jobs (≥10 hrs) — highest of any make, more than Volvo on a per-vehicle basis",
    },
    {
        "id": "R07",
        "name": "ford_ram_truck_flag",
        "description": "F-150, F-250, Ram 1500/2500/3500 + major repair = require estimate, auto-extend expected completion by 3 days",
        "enforcement": "SOFT_WARN",
        "trigger": "vehicle_make IN ['Ford', 'Ram', 'Dodge'] AND vehicle_model IN ['F-150', 'F-250', 'Ram 1500', 'Ram 2500', 'Ram 3500', 'Dakota'] AND job_type IN ['engine', 'transmission', 'drivetrain', 'suspension', 'major_repair']",
        "data_basis": "Ford + Ram/Dodge combine for 26 big jobs in dataset; consistently high days-in-shop",
    },
    {
        "id": "R08",
        "name": "volvo_major_flag",
        "description": "Volvo XC90 or S60 + engine/timing/AWD = elevated week-killer flag",
        "enforcement": "SOFT_WARN",
        "trigger": "vehicle_make == 'Volvo' AND vehicle_model IN ['XC90', 'S60'] AND job_type IN ['engine', 'timing', 'timing_chain', 'awd', 'transfer_case', 'electrical_major']",
        "data_basis": "XC90 and S60 appear in top 30 week-killers multiple times each; 60 total big Volvo jobs in dataset",
    },
    {
        "id": "R09",
        "name": "mini_cooper_buffer",
        "description": "Mini Cooper: auto-add 2 business days to expected completion regardless of tech hours",
        "enforcement": "TRACK",
        "trigger": "vehicle_make == 'Mini'",
        "action": "expected_completion_days += 2",
        "data_basis": "Mini has highest avg days-in-shop (7.5) of any make with ≥10 ROs — parts availability delays dominate",
    },
    {
        "id": "R10",
        "name": "lead_tech_stagger",
        "description": "Do not book two lead-tech-intensive jobs (>4 hrs each) on the same START date",
        "enforcement": "HARD_BLOCK",
        "trigger": "labor_estimate_hours > 4 AND day_lead_tech_intensive_count >= 1",
        "data_basis": "Baker + Adams Sr. are 73% of production; simultaneous heavy jobs is the primary week-chaos driver",
    },
    {
        "id": "R11",
        "name": "october_march_throttle",
        "description": "October and March: reduce max daily appointments to 5 (seasonal ARO trough)",
        "enforcement": "SOFT_WARN",
        "trigger": "booking_month IN [3, 10] AND day_total_appointments >= 5",
        "data_basis": "October is worst ARO month all 3 years ($526/$598/$702). March consistently below average.",
    },
    {
        "id": "R12",
        "name": "week_killer_present_throttle",
        "description": "Week containing a ≥15 tech hour job: cap new drop-off bookings at 4/day for that week",
        "enforcement": "HARD_BLOCK",
        "trigger": "week_has_week_killer == True AND day_dropoff_count >= 4",
        "data_basis": "Week-killer consumes 1 full lead tech; remaining effective capacity drops to ~8 hrs/day from 2nd tech",
    },
    {
        "id": "R13",
        "name": "diagnosis_only_buffer",
        "description": "Diagnosis-only ROs from new customers: assign 3-day placeholder, no bay hold until post-diagnosis",
        "enforcement": "TRACK",
        "trigger": "job_type == 'diagnosis' AND customer_visit_count <= 1",
        "action": "estimated_duration_days = 3, bay_hold = False, flag_for_post_diag_review = True",
        "data_basis": "Diagnostic ROs have high scope-creep into week-killers; unknown vehicle history is the primary risk",
    },
    {
        "id": "R14",
        "name": "non_core_make_limit",
        "description": "Makes outside top 5 (Volvo/Chevrolet/Ford/BMW/Toyota): max 2 per week if estimated >3 hrs",
        "enforcement": "SOFT_WARN",
        "trigger": "vehicle_make NOT IN ['Volvo', 'Chevrolet', 'Ford', 'BMW', 'Toyota'] AND labor_estimate_hours > 3 AND week_non_core_heavy_count >= 2",
        "data_basis": "Non-core makes have higher avg days-in-shop and less predictable part availability",
    },
    {
        "id": "R15",
        "name": "noshow_rebook_trigger",
        "description": "RO closing same-day with $0 revenue and 0 tech hours → auto-trigger SMS/email re-booking",
        "enforcement": "TRACK",
        "trigger": "total_revenue == 0 AND tech_hours == 0 AND days_in_shop == 0",
        "action": "tag as PROBABLE_NOSHOW, trigger re-booking comms within 2 hours",
        "data_basis": "~99 confirmed no-shows over 3 years (~2.75/month); same-day slot recapture is achievable",
    },
]
```
---
## Week Health Scoring
A week's schedule health can be scored 0–100 based on these factors. Use for dashboard display and Bailey's weekly planning view.
```python
def score_week_health(week_data: dict) -> dict:
    """
    Returns health score 0-100 and contributing factors.

    week_data keys:
        total_ros: int
        total_tech_hours: float
        waiter_count: int
        dropoff_count: int
        week_killer_count: int          # jobs ≥15 hrs
        big_job_count: int              # jobs ≥10 hrs
        friday_new_appointments: int
        projected_revenue: float
    """
    score = 100
    flags = []
    # Tech hour load (ceiling: 80 hrs/week = 16/day × 5 days)
    utilization = week_data["total_tech_hours"] / 80
    if utilization > 1.0:
        score -= 25
        flags.append("OVERLOADED: tech hours exceed weekly ceiling")
    elif utilization > 0.85:
        score -= 10
        flags.append("HEAVY: approaching tech hour ceiling")
    elif utilization < 0.40:
        score -= 15
        flags.append("UNDERUTILIZED: revenue opportunity being left on table")
    # Waiter ratio
    total = week_data["total_ros"] or 1
    waiter_pct = week_data["waiter_count"] / total
    if waiter_pct > 0.30:
        score -= 20
        flags.append(f"HIGH WAITER RATIO: {waiter_pct:.0%} (target: 10-20%)")
    elif waiter_pct < 0.05:
        score -= 5
        flags.append("LOW WAITER RATIO: consider adding 1-2 waiters")
    # Week-killer management
    if week_data["week_killer_count"] > 2:
        score -= 30
        flags.append("CRITICAL: 3+ week-killer jobs — chaos risk is extreme")
    elif week_data["week_killer_count"] == 2:
        score -= 10
        flags.append("ELEVATED: 2 week-killers — monitor closely")
    # Friday protection
    if week_data["friday_new_appointments"] > 2:
        score -= 15
        flags.append("FRIDAY OVERBOOKED: close-out day compromised")
    # Revenue projection vs baseline
    if week_data["projected_revenue"] > 35000:
        score += 10  # bonus for elite week setup
        flags.append("ELITE WEEK: projected >$35k")
    elif week_data["projected_revenue"] < 12000:
        score -= 10
        flags.append("LOW REVENUE WEEK: below $12k projected")
    return {
        "score": max(0, min(100, score)),
        "grade": "A" if score >= 85 else "B" if score >= 70 else "C" if score >= 55 else "D" if score >= 40 else "F",
        "flags": flags,
    }
```
---
## Week-Killer Detection at Booking Time
```python
WEEK_KILLER_SIGNALS = {
    # Format: signal_key: (risk_level, action_required)

    # Extreme — auto-block, require full plan
    "labor_estimate_gte_8hrs":          ("EXTREME", "HARD_BLOCK"),
    "job_type_engine_rebuild":          ("EXTREME", "HARD_BLOCK"),
    "job_type_transmission_rebuild":    ("EXTREME", "HARD_BLOCK"),
    "job_type_head_gasket":             ("EXTREME", "HARD_BLOCK"),
    # High — require estimate before confirming
    "chevy_truck_major_repair":         ("HIGH", "REQUIRE_ESTIMATE"),
    "volvo_xc90_s60_engine_timing":     ("HIGH", "REQUIRE_ESTIMATE"),
    "ford_f150_ram_drivetrain":         ("HIGH", "REQUIRE_ESTIMATE"),
    "audi_q7_sq7_dsg_air_suspension":   ("HIGH", "REQUIRE_ESTIMATE"),
    "labor_estimate_5_to_8hrs":         ("HIGH", "REQUIRE_ESTIMATE"),
    # Moderate — flag, add buffer days
    "bmw_3_5_series_timing_cooling":    ("MODERATE", "ADD_2_DAY_BUFFER"),
    "mini_cooper_any_repair":           ("MODERATE", "ADD_2_DAY_BUFFER"),
    "unknown_history_diagnosis":        ("MODERATE", "3_DAY_PLACEHOLDER"),
    "volkswagen_major_repair":          ("MODERATE", "ADD_1_DAY_BUFFER"),
    # Watch — permit, reduce surrounding capacity
    "two_plus_lead_tech_jobs_same_week": ("WATCH", "REDUCE_WEEKLY_SLOTS"),
    "week_already_at_130hrs":            ("WATCH", "WAITERS_ONLY"),
}
def count_week_killer_signals(booking: dict) -> dict:
    """
    Evaluate a booking request against week-killer signals.
    Returns signal count by severity and recommended action.

    If ANY EXTREME signal: return HARD_BLOCK regardless of count.
    If 2+ HIGH signals: escalate to HARD_BLOCK.
    If 1 HIGH signal: REQUIRE_ESTIMATE.
    """
    ...
```
---
## Seasonal Scheduling Calendar
```python
SEASONAL_ARO_PROFILE = {
    # month_number: {"aro_index": float, "volume_index": float, "notes": str}
    # aro_index: 1.0 = avg, >1.0 = above avg, <1.0 = below avg
    1:  {"aro_index": 1.03, "volume_index": 0.95, "notes": "Strong ARO, light volume — good for complex jobs"},
    2:  {"aro_index": 1.11, "volume_index": 0.90, "notes": "Best ARO month — prioritize high-value work"},
    3:  {"aro_index": 0.88, "volume_index": 1.05, "notes": "ARO trough — throttle complex unknowns"},
    4:  {"aro_index": 1.01, "volume_index": 1.05, "notes": "Average — normal scheduling"},
    5:  {"aro_index": 1.05, "volume_index": 1.00, "notes": "Above average — good mix month"},
    6:  {"aro_index": 0.95, "volume_index": 1.15, "notes": "High volume, moderate ARO — watch waiter ratio"},
    7:  {"aro_index": 1.04, "volume_index": 1.10, "notes": "High volume + decent ARO — strong month"},
    8:  {"aro_index": 1.16, "volume_index": 1.00, "notes": "Peak ARO month — schedule complex jobs here"},
    9:  {"aro_index": 0.95, "volume_index": 1.05, "notes": "Slightly below avg — normal scheduling"},
    10: {"aro_index": 0.79, "volume_index": 1.05, "notes": "WORST ARO MONTH — avoid scheduling complex unknowns"},
    11: {"aro_index": 0.96, "volume_index": 0.90, "notes": "Below avg volume — fill with quality drop-offs"},
    12: {"aro_index": 1.11, "volume_index": 0.90, "notes": "Strong ARO despite holidays — good for complex jobs"},
}
# Throttle daily booking ceiling in low-ARO months
MONTH_BOOKING_CEILING_OVERRIDE = {
    3:  7,   # March: hold at 7 (vs normal 9)
    10: 5,   # October: hold at 5 (worst ARO month)
}
```
---
## Day-of-Week Strategy
```python
DOW_STRATEGY = {
    "Monday": {
        "role": "INTAKE",
        "max_new_appointments": 7,
        "allow_waiters": True,
        "allow_large_dropoffs": True,
        "notes": "Lowest ARO day ($652). Use for intake of complex jobs that will close Friday.",
    },
    "Tuesday": {
        "role": "PRODUCTION",
        "max_new_appointments": 8,
        "allow_waiters": True,
        "allow_large_dropoffs": True,
        "notes": "Mid-week production. Normal scheduling.",
    },
    "Wednesday": {
        "role": "PRODUCTION",
        "max_new_appointments": 8,
        "allow_waiters": True,
        "allow_large_dropoffs": True,
        "notes": "Mid-week production. Normal scheduling.",
    },
    "Thursday": {
        "role": "PRODUCTION",
        "max_new_appointments": 7,
        "allow_waiters": True,
        "allow_large_dropoffs": False,  # Large jobs started Thu rarely close Fri
        "notes": "Begin throttling large intakes. Jobs started Thu may bleed into next week.",
    },
    "Friday": {
        "role": "CLOSEOUT",
        "max_new_appointments": 2,
        "allow_waiters": True,          # Waiters OK on Friday (same-day)
        "allow_large_dropoffs": False,  # HARD RULE
        "notes": "CLOSEOUT DAY. $957 avg ARO driven by completing Mon-Thu work. Protect at all costs.",
        "hard_rule": "NO new drop-off estimates >4 tech hours may be scheduled to START on Friday",
    },
}
```
---
## Job Mix Targets (Weekly)
Based on the top-15 revenue weeks, the ideal weekly schedule looks like:
```python
IDEAL_WEEK_TARGETS = {
    "total_ros": {"min": 25, "target": 30, "max": 40},
    "total_tech_hours": {"min": 60, "target": 80, "max": 110},
    "waiters": {"min": 3, "target": 5, "max": 8},
    "dropoffs": {"min": 20, "target": 25, "max": 35},
    "big_jobs_10plus_hrs": {"min": 1, "target": 3, "max": 4},
    "week_killers_15plus_hrs": {"min": 0, "target": 1, "max": 2},
    "projected_revenue": {"baseline": 20810, "good": 28000, "elite": 38000},
}
# The $40k+ week formula (confirmed in data):
# 3-4 large jobs (≥10 hrs) + 25-35 routine drops + 4-9 waiters
# All large jobs pre-scheduled with explicit bay reservations ≥1 week ahead
```
---
## Entities & Field Mappings (ShopWare → RO Engine)
```python
# ShopWare export field → RO Engine field → scheduling relevance
FIELD_MAP = {
    "Label":            "appointment_type",        # 'Waiter' | 'Drop Off'
    "Advisor":          "service_advisor",          # Bailey Buchholz = primary
    "Started At":       "intake_datetime",          # Job start
    "Closed At":        "close_datetime",           # Used for days_in_shop calc
    "Vehicle Make":     "vehicle_make",             # Week-killer signal
    "Vehicle Model":    "vehicle_model",            # Week-killer signal
    "Vehicle Year":     "vehicle_year",             # Context
    "Total with Tax":   "total_revenue",            # ARO calc, $0 = no-show flag
    "Labor Total":      "labor_revenue",            # Scheduling weight
    # Tech columns (Joe Sprandel, Nick Adams, Les Baker, etc.)
    # → sum to total_tech_hours for capacity calc
    "Les Baker":        "lead_tech_1_hours",        # Primary capacity signal
    "Nicholas Adams Sr.": "lead_tech_2_hours",      # Primary capacity signal
}
# days_in_shop = (close_date.date() - started_date.date()).days  # clip to 0 min
# total_tech_hours = sum(all tech hour columns per RO)
# is_week_killer = total_tech_hours >= 15
# is_big_job = total_tech_hours >= 10
# is_probable_noshow = total_revenue == 0 AND total_tech_hours == 0 AND days_in_shop == 0
```
---
## Advisor & Tech Context
- **Bailey Buchholz** — Service Advisor on 88% of all ROs. Single point of contact. Any rule requiring SA intervention routes to Bailey. SA burnout is a real constraint; do not design rules that create excessive interruption loops.
- **Les Baker** — Lead Tech #1. 4,431 hrs / 1,182 ROs. Max recorded single-job: 34.0 hrs. Daily avg on active days: 7.5 hrs (94% utilization).
- **Nicholas Adams Sr.** — Lead Tech #2. 4,127 hrs / 1,298 ROs. Max recorded: 28.6 hrs.
- **Nick Adams (Jr.)** — Support tech. 1,834 hrs. Primarily assists on lighter work.
- **Joe Sprandel** — Support tech. 583 hrs. Lighter jobs, maintenance.
- **Steve Wilson** — Advisor on ~8% of ROs (317 total). Secondary SA or owner/Fren.
---
## No-Show / Cancellation Handling
```
Probable no-show detection:
  total_revenue == 0 AND tech_hours == 0 AND days_in_shop == 0
Rate: ~99 over 3 years = 2.75/month = ~0.07/day
Do NOT:
  - Overbook as hedge (chaos cost > no-show cost)
  - Flag no-show risk based on DOW (even distribution Mon-Fri)
DO:
  - Tag RO as PROBABLE_NOSHOW on close
  - Trigger SMS/email re-booking prompt within 2 hours
  - Track by customer ID — repeat no-shows warrant deposit requirement
  - Log slot recovery rate for analytics
```
---
## Data Notes for Future Exports
- **Date range in this dataset:** 2023-01-01 to 2025-12-31 (36 months)
- **Total rows in export:** 6,522 (including $0 accounting entries)
- **Revenue-producing ROs analyzed:** 4,225
- **Excluded:** ROs where both `Total with Tax == 0` AND `total_tech_hours == 0` (accounting/deposit entries)
- **Tech hour columns** are per-technician and must be summed for total hours
- **`days_in_shop`** must be calculated from `Started At` and `Closed At` date components only (normalize to midnight before diff)
- **Outlier warning:** Some ROs show 100+ days in shop — these represent jobs that were opened months prior or had extended parts waits. Do not use raw `days_in_shop` mean without percentile filtering.
---
*AutoHouse Automotive | RO Engine | Scheduling Rules Engine Design Brief*
*Generated: February 2026 | Source: ShopWare closed_sales export*

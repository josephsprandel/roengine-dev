"""
Maintenance Schedule Lookup

VIN -> NHTSA decode -> powertrain config match -> full schedule.
Given a VIN and current mileage, returns:
  - All maintenance items with OEM intervals
  - AutoHouse recommended intervals (where available)
  - Which items are due/overdue/upcoming
  - Service kits that bundle related items

If no powertrain config match exists, triggers on-demand Gemini extraction.
"""

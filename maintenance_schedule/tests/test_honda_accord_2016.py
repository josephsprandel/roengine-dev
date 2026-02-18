"""
Validation: 2016 Honda Accord V6-3.5L — J35Y1

Tests the Honda Maintenance Minder code-based system:
- Service A = oil change without filter
- Service B = oil change with filter + full inspection
- Sub-item 1 = tire rotation
- Sub-item 2 = air filter, cabin filter, drive belt inspect
- Sub-item 3 = transmission fluid (ATF DW-1 for auto, HCF-2 for CVT)
- Sub-item 4 = spark plugs, timing belt (V6 only), valve clearance
- Sub-item 5 = engine coolant

Verifies that service_code_systems and service_code_definitions are populated correctly.
Verifies algorithm_driven interval_type with 12-month fallback.
"""

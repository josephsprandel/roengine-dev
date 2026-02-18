"""
Schedule Data Validation Engine

Applies validation_rules to Gemini-extracted maintenance schedule data.
Flags entries that fall outside expected bounds.
Checks for common hallucination patterns:
  - Unreasonable intervals (oil change at 50k, spark plugs at 5k)
  - Missing common items (no oil change entry for a gas engine)
  - Action type mismatches (description says "replace" but action_type is "inspect")
"""

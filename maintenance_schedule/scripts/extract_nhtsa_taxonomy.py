"""
NHTSA vPIC Taxonomy Extraction

Downloads/queries the NHTSA vPIC database to extract the complete
year/make/model/engine taxonomy for all US consumer vehicles.
Populates the nhtsa_vehicle_taxonomy table.

Target: 34 consumer makes, years 2000-2026
Expected output: ~22,000 vehicle applications, ~4,000-6,000 unique powertrain configs
"""

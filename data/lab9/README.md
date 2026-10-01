# Lab 9 geographic data

`world.geojson` is Natural Earth 1:50m Admin 0 Countries, downloaded 2026-10-01 from:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson

Natural Earth data are public domain: https://www.naturalearthdata.com/about/terms-of-use/

Geometry is unchanged. Properties are reduced to `name`, `iso3`, and a representative label-point `anchor`. Natural Earth's `ADM0_A3` matches the supplied ISO-3 identifiers for all 50 economies and keeps offshore map units distinct (unlike `ISO_A3_EH`, which repeats AUS). Nonstandard map-unit codes outside the supplied dataset remain unmatched and neutral. All 50 assignment GDP identifiers match exactly once, including HKG, SGP, TWN, FRA, and NOR. Antarctica is omitted from the displayed maps; its source geometry remains in this file.

To regenerate, download the above URL to `data/lab9/world-source.geojson`, run `python lab9/prepare_boundaries.py`, and remove the intermediate source file. The supplied GDP CSV is unchanged. Only included GDP values receive cartogram circles; missing values are never imputed as zero.

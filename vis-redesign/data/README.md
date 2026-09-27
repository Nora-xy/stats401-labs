# Data provenance

Downloaded September 27, 2026. No API key is needed to run the page.

- `co-est2020.csv`: U.S. Census Bureau, vintage 2020 county population estimates. Source: https://www2.census.gov/programs-surveys/popest/datasets/2010-2020/counties/totals/co-est2020.csv
- Population field: `POPESTIMATE2020`, July 1, 2020 resident population estimate. This is **not** the April 2020 decennial census count.
- `gazetteer-2020.zip`: official county Gazetteer. Source: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_counties_national.zip
- Land area field: `ALAND_SQMI`, square miles of land, excluding water. Retains the published precision.
- `counties-10m.json`: https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json ; simplified 2017 Census geography. The original JSON includes territories; the app explicitly displays state FIPS below 57 (50 states and DC).

`python scripts/prepare_data.py` joins county records by five-digit FIPS, retaining leading zeros, and writes `county-density-2020.csv`. Density is computed in D3 as population / land_sq_mi. No rounded density is used in color classification.

To reconcile a known vintage mismatch, 2020 Chugach (02063) and Copper River (02066) are combined into the 2017 Valdez-Cordova area (02261). Both population and land area are summed before division. The combined name is shown in lookup. This creates 3,142 mapped areas from 3,143 population records. No county area is estimated from simplified polygons. Minor boundary revisions across vintages are not corrected, so this is a design demonstration, not a geographic change analysis.

The map and histogram use the same 3,142 areas. Histogram edges run from 0.01 to 100,000 in steps of 0.5 log10 units. Each bin includes its lower edge and excludes its upper edge. Every record is covered. National color thresholds: 1, 10, 50, 100, 500, 1,000, 5,000. Rural thresholds: 1, 2, 5, 10, 20, 50, 100. A value on a threshold enters the higher class. Density values are rounded only for display.

The previous live Census API dependency was removed because it returned a Missing Key HTML page. All chart data and JavaScript are now local. The original TIME measurements are not reconstructed.

# Lab 9: Geospatial Visualization

Open `/lab9/` on the course website, or run `python -m http.server 8000` from the repository root and visit http://localhost:8000/lab9/. No build step or remote runtime dependencies are required.

## Features

- Natural Earth 1:50m GeoJSON and the unchanged provided 2025 GDP CSV, joined by normalized ISO-3 identifiers; all 50 economies match.
- D3 Natural Earth projection and `geoPath`, a logarithmic quantitative color legend, missing-data treatment, tooltips, zoom/pan, and reset.
- Dorling cartogram with circle area directly proportional to GDP, geographic attraction, collision separation, and a quantitative area legend. This is a noncontiguous circle cartogram, not a boundary-deformation cartogram.
- Linked hover, click, keyboard selection, and an economy selector that centers the choropleth. Orange locator rings help find small economies without changing their boundary areas.
- A 222-word design comparison and linked data/method sources.

## Validation

`node lab9/validate_lab9.cjs` uses the existing local jsdom installation in `.lab8-cache/test/node_modules`. On a fresh checkout, install it with `npm install --prefix .lab8-cache/test jsdom` first.

The check covers matches, missing GDP values, valid geographic paths, proportional circle areas, overlap/clipping, linked interactions, keyboard control, country selection, zoom/reset, comparison length, and load-error reporting. It writes review SVGs to the ignored `.lab8-cache/lab9/` directory. A full responsive browser review is still recommended.

Boundary source and normalization details are documented in `../data/lab9/README.md`. GDP figures are estimates from the course-provided dataset, not refreshed current figures.

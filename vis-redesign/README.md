# Visualization Critique and Redesign

TIME's *Where America Lives*, critiqued and redesigned with D3.js.

## View locally

From this folder run `python -m http.server 8000`, then open http://localhost:8000 . All chart scripts, data, and images are included locally. Opening index.html directly will not reliably load the CSV/JSON.

## Course website

The completed project belongs in `stats401-labs/vis-redesign/`. The course homepage links to it under **Visualization Critique and Redesign**. After you commit and push to the branch used by GitHub Pages, its expected URL is:

https://nora-xy.github.io/stats401-labs/vis-redesign/

This URL is the deployment target, not a claim that the new page has already been published. No commit or push is performed here.

## Deliverables

- `index.html`, `app.js`, `style.css`: interactive visualization and critique overview.
- `report.html`: browser-readable illustrated report; `report.md`: editable source. Body: approximately 655 words, excluding figures and references.
- `assets/redesign-full.png`, `assets/redesign-low.png`: screenshots from the working D3 page.
- `Where Americans Live.png`: supplied original visualization.
- `Xinyi_Liu.pptx`, `Xinyi_Liu.pdf`: updated one-slide presentation in FirstName_LastName format.
- `presentation_script.md`: approximately one minute of speaking notes.
- `data/README.md`: sources, field definitions, vintage mismatch, and processing.
- `vendor/`: pinned D3 7.9.0 and TopoJSON Client 3.1.0, with licenses.

## Data and interaction

July 2020 Census Bureau population **estimates**, divided by official Gazetteer land area. Simplified 2017 boundaries, with Chugach and Copper River aggregated to the former Valdez-Cordova area. Covers 3,142 areas in the 50 states and DC. Territories are excluded.

Use the scale selector for national or rural detail, county lookup for keyboard access, or hover/tap to inspect values. Click a county to retain its values. Zoom buttons and dragging support small counties. The linked histogram counts county areas in equal-width log bins, not people. Gray in rural mode means density of at least 100 people per land square mile.

## Reproduce and verify

The page itself needs no package installation or build step. `python scripts/prepare_data.py` regenerates the cleaned CSV from the included public source files. `python scripts/build_report.py` regenerates report.html from report.md.

Browser verification checked 3,142 joined county areas, complete histogram counts, both color scales, linked county lookup, zoom/reset, and mobile layout without horizontal document overflow. No JavaScript errors were observed.

Optional browser verification: install Playwright (`python -m pip install playwright`) and run `python scripts/verify_browser.py`. The script uses installed Windows Chrome and writes QA images into `tmp/`; it requires port 8765 to be free. Create `tmp/` first if absent.

## Local files excluded from Git

The project `.gitignore` excludes `scripts/`, `tmp/`, Python caches, `presentation_script.md`, `Xinyi*.pptx`, `Xinyi*.pdf`, and the unused `assets/slide-redesign.png`. These remain on your computer but are excluded from new Git additions. The website retains the chart JavaScript, libraries, data, report, and report images.

From `stats401-labs`, run `git status --short` before committing. If a file was already tracked, `.gitignore` does not untrack it; use `git rm --cached -- path/to/file` for that specific file. This removes it from Git's index while preserving the local copy.

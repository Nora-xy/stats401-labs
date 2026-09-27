# Lab 8: Inside the bulletin

Run `python -m http.server 8000` from the repository root and open
<http://localhost:8000/lab8/>. The delivered page uses precomputed data and the
repository's local D3 v7 copy; it needs no model server or API key.

## Source and corpus

User-provided **Bulletin of Duke Kunshan University Undergraduate Instruction,
2023–2024**, published July 2023, filename `ug_bulletin 2023-24.pdf`.
Accessed September 27, 2026. SHA-256 and cleaning counts are recorded in
`../data/lab8/corpus_audit.json`. The original PDF is not duplicated in the repo.

The source has 509 PDF pages. Printed page numbers are one less than PDF page
numbers. Typography and the table of contents establish heading boundaries.
Paragraph spacing establishes passage boundaries; unfinished sentences can
continue across pages. Course titles remain with their descriptions. Blocks
longer than 220 words are split at sentence boundaries. Start and end pages
refer to the source block, so split blocks can share page ranges.

Excluded material: cover and front matter, contents, footer numbers, small-print
footnotes, tabular course-list rows, table instructions, incomplete blocks,
blocks under 20 words, and exact duplicate blocks. Counts before cleaning refer
to extracted blocks after structural headings and recognized table rows are
removed; counts after cleaning include sentence-based splitting. This is a prose
corpus, not a lossless reconstruction of tables. Heuristic extraction can omit
short valid notices or misinterpret complex formatting.

`chapter` preserves the bulletin Part. `section` uses the first TOC level beneath
the Part, except Part 10 uses named majors and course subjects to avoid collapsing
most passages into a single matrix row. `subsection` retains a deeper heading or
course title; `heading_path` also preserves the TOC hierarchy. Source headings
with no retained prose do not become empty matrix rows.

## Semantic methods

The [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
documents the model and attention-mask mean pooling. `embed_corpus.py` implements
that pooling using Transformers and PyTorch. Revision is pinned. Inputs longer
than 254 content tokens use non-overlapping windows; their mean-pooled vectors
are combined using content-token counts, then L2 normalized. All 384 dimensions
are retained for clustering and similarity. Text is not stop-word stripped before
embedding.

UMAP: 2 dimensions, cosine metric, 15 neighbors, min_dist 0.15, random_state 401.
KMeans: eight clusters on original normalized vectors, n_init 10, seed 401.
Eight topics follow the lab example; this is not a claim that eight is an optimal
or uniquely correct taxonomy. Topic names in `topic_labels.json` were assigned
after inspecting centroid-near passages and mean TF-IDF terms. Evidence is in
`../data/lab8/topic_review.json`. TF-IDF uses English stop words plus generic
bulletin words, min_df 3 and max_df 0.8; it is used for interpretation, not as a
substitute for semantic embeddings. Some clusters combine disparate subjects.

Five neighbors are ranked by cosine similarity in the original embeddings.
Section diversity is Shannon entropy in bits, comparing sections with at least
ten passages; the maximum for eight topics is 3 bits. Similarities can be high
for cross-listed courses or near-duplicate policy wording; similarity does not
establish that two rules are interchangeable.

## Views and interaction

The map and matrix sit side by side on desktop, stacking on small screens.
Point color encodes topic and point area encodes passage word count. UMAP axes
have no independent semantic interpretation. Matrix cells show **full-corpus
counts**, not percentages, with a fixed linear color scale. Numbered columns
correspond to the topic legend. Scroll the matrix to see all formal sections.

Click a cell to highlight its intersection on the map; click again to clear.
Search, section filter, topic filter, and matrix selection intersect. Nonmatching
points remain faint for context. Click a point to reveal its original passage,
metadata, and five neighbors and to outline its matrix cell. Neighbor buttons
navigate to those passages. Neighbor computation always uses the full corpus.
Zoom/pan changes the map only. Reset clears all selections and restores the map.

The page includes two corpus summaries, four evidence-based findings and a
200–300 word design description. Data and source-code download links are in its
footer. No external page content is inserted as HTML.

## Rebuild

Use Python 3.13 with `pip install -r lab8/requirements.txt` in an isolated
environment. Run these commands from the repository root:

```powershell
python lab8/extract_source.py 'PATH/TO/ug_bulletin 2023-24.pdf'
python lab8/prepare_corpus.py
python lab8/embed_corpus.py
python lab8/analyze_corpus.py
python lab8/validate_data.py
```

Model weights download on the first embedding run. Intermediate source geometry
and vectors live in ignored `.lab8-cache/`. Final CSV and JSON exports live in
`data/lab8/`. Local session dependencies are ignored in `.lab8-runtime/`; when
using that folder set `$env:PYTHONPATH='.lab8-runtime'` first. Regenerated clusters
must be inspected again before reusing labels if the input or model changes.

Data validation checks hierarchy, normalized vectors, finite coordinates, matrix
totals, labels and every nearest-neighbor ranking. DOM interaction checks:

```powershell
npm install --prefix .lab8-cache/test jsdom --no-audit --no-fund
node lab8/validate_ui.cjs
```

These exercise search, empty results, filtering, linked cell selection, passage
details, neighbor navigation, and reset. DOM tests do not replace a visual browser
review; no connected browser was available in the build session.

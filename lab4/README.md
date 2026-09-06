# Lab 4: Cleaning Web Data for Visualization

**Question:** How does sentiment differ between disaster-related and unrelated tweets?

This assignment analyzes a deterministic random sample of 1,500 cleaned tweets and displays one interactive D3 100% stacked bar chart. Hover, tap, or keyboard-focus a segment for counts. A data table provides the same information accessibly. The 100–200 word analysis is generated from the real model output.

## Source and provenance

- Dataset: [Disasters on social media](https://www.kaggle.com/datasets/jannesklaas/disasters-on-social-media), distributed by Jannes Klaas; originally CrowdFlower/Figure Eight Data for Everyone.
- The distributor lists the dataset as **CC0: Public Domain**. The downloaded source is retained unchanged in `../data/lab4_raw_tweets.csv`.
- Download endpoint: `https://www.kaggle.com/api/v1/datasets/download/jannesklaas/disasters-on-social-media`.
- Archive member: `socialmedia-disaster-tweets-DFE.csv`; 10,876 rows and 13 columns. Retrieved September 6, 2026.
- Original CSV SHA-256: `9c6e3d4312d0ae54b9197f2d06fcf44f09936bc78a14ff07902d1d59c9e857c5`.
- Supplied relevance annotations are **not** sentiment labels, and are never used as inputs to the sentiment model.

## Reproduce

Use Python 3.13 in an environment with the pinned requirements. From the repository root:

```bash
python -m pip install -r lab4/requirements.txt
python lab4/acquire_data.py --model
python lab4/clean_tweets.py
python -m http.server 8000
```

Open `http://localhost:8000/lab4/`. Do not open the HTML using `file://`, since the page fetches CSV and JSON data. No API key is required. The first run needs internet to download approximately 500 MB of model weights and small NLTK resources. Inference then runs on the CPU. Downloads stay in `.lab4-cache/`, which is excluded from Git. This workspace also supports dependencies installed into the ignored `.lab4-deps/` directory.

The default sample uses `--sample-size 1500 --seed 401 --batch-size 16`. Every tweet in the selected sample receives actual model inference. Unselected source rows are retained in the raw file but are not claimed as analyzed. Running the script overwrites its generated Lab 4 exports.

## Cleaning decisions

1. Read all fields as strings, using Latin-1 to preserve the source bytes. The original is not valid UTF-8. Preserve `tweet_text_raw`; separately decode HTML entities, collapse whitespace, trim, and remove nonprinting control characters. Some source mojibake remains; no missing text is guessed.
2. Check missing text, empty text, complete duplicate rows and duplicate annotation IDs. Remove 199 repeated cleaned texts, keeping the first in source order. This counts identical messages once, rather than treating repeated copies as independent content.
3. Normalize the supplied relevance labels. Remove the 15 remaining rows with ambiguous labels after text deduplication. There are 10,662 eligible records.
4. Preserve `tweetid` as `source_tweet_id` rather than attempting to reconstruct rounded scientific-notation IDs. Use `_unit_id` as `record_id`; it uniquely identifies a source annotation record, not necessarily an original Twitter ID. Dropping repeated rounded tweet IDs would incorrectly discard different tweets.
5. Decode percent-encoded keywords, trim category strings, and mark missing locations and keywords as unknown. Do not interpret free-text locations as verified countries. Convert annotation confidence to a number and check the [0, 1] range.
6. Do not invent missing variables. `_last_judgment_at` is an annotation timestamp, not a tweet timestamp. This source has no usable tweet posting dates or engagement counts.
7. Sample 1,500 eligible records using pandas `random_state=401`, then sort by record ID. The sample contains 633 disaster-related and 867 unrelated tweets. It is a sample of this keyword-selected corpus, not a representative sample of Twitter.

## Text analysis

**TF-IDF branch:** Normalize URLs, mentions and numbers; tokenize with NLTK, remove English stop words, and apply WordNet's default noun lemmatization to alphabetic tokens. Use `min_df=2`, `max_df=0.90`. Export sparse DTM and TF-IDF matrices, their vocabulary, and matching row identifiers. These matrices have 1,500 rows and 1,795 terms. Placeholder tokens may appear in the vocabulary. This branch is separate from sentiment.

**Sentiment branch:** Use [cardiffnlp/twitter-roberta-base-sentiment-latest](https://huggingface.co/cardiffnlp/twitter-roberta-base-sentiment-latest), pinned to revision `3216a57f2a0d9c45a2e6c20157c20c49fb4bf9c7`. Normalize URLs to `http` and mentions to `@user`; preserve case, punctuation and negation. Run batches on CPU with truncation at 512 tokens. The classification head produces negative, neutral and positive probabilities. Save all three, the maximum-probability label, maximum probability as `model_confidence`, and `sentiment_score = P(positive) - P(negative)`. Confidence is a model score, not a guarantee of accuracy. A score near zero can indicate neutrality or competing predictions.

## Outputs in `data/`

| File | Contents |
| --- | --- |
| `lab4_raw_tweets.csv` | Unchanged source, 10,876 records |
| `lab4_clean_tweets.csv` | One row per analyzed record, 1,500 records |
| `lab4_sentiment_by_relevance.csv` | Six group–sentiment combinations, counts and proportions |
| `lab4_cleaning_report.json` | Audit counts, missingness, model revision and source hash |
| `lab4_dtm.npz` / `lab4_tfidf.npz` | Sparse matrices, load with `scipy.sparse.load_npz` |
| `lab4_vocabulary.csv` | Matrix columns in order, document frequencies and mean TF-IDF |
| `lab4_matrix_rows.csv` | Matrix row identifiers in order |

`lab4/analysis.json` contains the generated written analysis and its word count. The webpage loads the small aggregate, report, and analysis, rather than loading all tweet text into the chart.

## Validation and publishing

The pipeline checks record/text uniqueness, at least 1,000 analyzed records, valid probabilities summing to one, scores within [-1, 1], aggregate totals, matrix vocabulary alignment, and the analysis word count. `validate_lab4.py` independently checks exported values and local page links.

The page uses the repository's existing GitHub Pages structure and local D3 7.9.0; no bundler is needed. D3's license is included under `vendor/`. Once deployed from `main`, the assignment URL is `https://Nora-xy.github.io/stats401-labs/lab4/`.

The provided 50-row `lab4_dirty_tweets.csv` is a separate practice file and is not used to satisfy the 1,000-tweet assignment.

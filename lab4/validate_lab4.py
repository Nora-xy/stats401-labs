"""Check final exports independently of model execution; no network required."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import numpy as np
import pandas as pd
from bs4 import BeautifulSoup
from scipy.sparse import load_npz

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
df = pd.read_csv(DATA / "lab4_clean_tweets.csv", dtype={"record_id": "string", "source_tweet_id": "string"})
report = json.loads((DATA / "lab4_cleaning_report.json").read_text(encoding="utf8"))
assert len(df) == report["sample_rows"] == 1500
assert df.record_id.is_unique and df.tweet_text.is_unique
assert df.tweet_text.notna().all() and df.tweet_text.str.strip().ne("").all()
labels = ["Negative", "Neutral", "Positive"]
columns = ["sentiment_" + label.lower() for label in labels]
probabilities = df[columns].to_numpy()
assert np.isfinite(probabilities).all()
assert ((probabilities >= 0) & (probabilities <= 1)).all()
assert np.allclose(probabilities.sum(axis=1), 1, atol=1e-5)
assert np.array_equal(np.array(labels)[probabilities.argmax(axis=1)], df.sentiment)
assert np.allclose(df.sentiment_score, df.sentiment_positive - df.sentiment_negative)
assert np.allclose(df.model_confidence, probabilities.max(axis=1))
summary = pd.read_csv(DATA / "lab4_sentiment_by_relevance.csv")
expected = df.groupby(["disaster_relevance", "sentiment"]).size()
assert len(summary) == 6
for row in summary.itertuples():
    assert row.count == expected.get((row.disaster_relevance, row.sentiment), 0)
    assert row.total == df.disaster_relevance.eq(row.disaster_relevance).sum()
    assert np.isclose(row.proportion, row.count / row.total)
assert np.allclose(summary.groupby("disaster_relevance").proportion.sum(), 1)
vocabulary = pd.read_csv(DATA / "lab4_vocabulary.csv")
rows = pd.read_csv(DATA / "lab4_matrix_rows.csv", dtype="string")
assert rows.record_id.equals(df.record_id)
counts = load_npz(DATA / "lab4_dtm.npz")
tfidf = load_npz(DATA / "lab4_tfidf.npz")
assert counts.shape == tfidf.shape == (len(df), len(vocabulary))
assert np.array_equal(np.asarray((counts > 0).sum(axis=0)).ravel(), vocabulary.document_frequency)
assert np.allclose(np.asarray(tfidf.mean(axis=0)).ravel(), vocabulary.mean_tfidf)
analysis = json.loads((ROOT / "lab4/analysis.json").read_text(encoding="utf8"))
assert 100 <= len(" ".join(analysis["paragraphs"]).split()) == analysis["word_count"] <= 200
page = ROOT / "lab4/index.html"
soup = BeautifulSoup(page.read_text(encoding="utf8"), "html.parser")
for tag in soup.find_all(["a", "link", "script"]):
    target = tag.get("href") or tag.get("src")
    if target and not urlsplit(target).scheme and not target.startswith("#"):
        assert (page.parent / unquote(urlsplit(target).path)).resolve().is_file(), target
assert soup.title.string == "Lab 4: Cleaning Web Data for Visualization"
print(f"PASS: {len(df):,} predictions, 6 chart segments, aligned TF-IDF matrices, "
      f"{analysis['word_count']}-word analysis, and all local page links.")

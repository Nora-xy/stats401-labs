"""Reproduce Lab 4: inspect, clean, sample, TF-IDF, RoBERTa, and aggregate.

Run from any directory: python lab4/clean_tweets.py
Run acquire_data.py --model first for a fully local model run.
"""
from pathlib import Path
import argparse
import hashlib
import html
import json
import os
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".lab4-deps"))
os.environ.setdefault("HF_HOME", str(ROOT / ".lab4-cache/huggingface"))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
import numpy as np
import pandas as pd
from acquire_data import MODEL, REVISION, acquire

DATA = ROOT / "data"
CLASSES = ["Negative", "Neutral", "Positive"]


def clean_string(text):
    text = html.unescape(str(text))
    # Remove nonprinting source control characters; do not invent missing text.
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def prepare_for_roberta(text):
    text = re.sub(r"https?://\S+|www\.\S+", "http", text)
    return re.sub(r"@\w+", "@user", text)


def clean_and_sample(size, seed):
    acquire()
    path = DATA / "lab4_raw_tweets.csv"
    raw = pd.read_csv(path, encoding="latin-1", dtype="string")
    report = {
        "source_rows": len(raw), "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "missing_before": raw.isna().sum().astype(int).to_dict(),
        "exact_duplicates": int(raw.duplicated().sum()),
        "repeated_source_tweet_ids": int(raw.tweetid.duplicated().sum()),
        "source_control_character_rows": int(raw.text.str.contains(r"[\x7f-\x9f]", na=False).sum()),
        "sample_seed": seed, "model": MODEL, "model_revision": REVISION,
    }
    df = raw.drop_duplicates().copy()
    df = df.rename(columns={"_unit_id": "record_id", "tweetid": "source_tweet_id", "text": "tweet_text_raw"})
    df["tweet_text"] = df.tweet_text_raw.fillna("").map(clean_string)
    report["empty_text_removed"] = int(df.tweet_text.eq("").sum())
    df = df.loc[df.tweet_text.ne("")].copy()
    report["duplicate_record_ids_removed"] = int(df.record_id.duplicated().sum())
    df = df.drop_duplicates("record_id")
    report["duplicate_clean_text_removed"] = int(df.tweet_text.duplicated().sum())
    df = df.drop_duplicates("tweet_text").copy()
    df["disaster_relevance"] = df.choose_one.str.strip().str.lower().map({
        "relevant": "Disaster-related", "not relevant": "Not disaster-related"
    })
    report["ambiguous_relevance_removed"] = int(df.disaster_relevance.isna().sum())
    df = df.dropna(subset=["disaster_relevance"]).copy()
    for column in ["keyword", "location"]:
        df[column] = df[column].map(lambda x: clean_string(unquote(x)) if pd.notna(x) else "")
        df[column] = df[column].replace("", "Unknown")
    df["keyword"] = df.keyword.str.lower()
    df["annotation_confidence"] = pd.to_numeric(df["choose_one:confidence"], errors="coerce")
    invalid = ~df.annotation_confidence.between(0, 1) & df.annotation_confidence.notna()
    report["invalid_annotation_confidence"] = int(invalid.sum())
    df.loc[invalid, "annotation_confidence"] = np.nan
    report["eligible_rows"] = len(df)
    if len(df) < size or size < 1000:
        raise ValueError("The assignment needs at least 1,000 eligible tweets.")
    df = df.sample(n=size, random_state=seed).sort_values("record_id").reset_index(drop=True)
    df["sentiment_text"] = df.tweet_text.map(prepare_for_roberta)
    report["sample_rows"] = len(df)
    report["relevance_counts"] = df.disaster_relevance.value_counts().astype(int).to_dict()
    return df, report


def add_tfidf(df, report):
    import nltk
    from nltk.corpus import stopwords
    from nltk.stem import WordNetLemmatizer
    from nltk.tokenize import word_tokenize
    from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
    from scipy.sparse import save_npz
    folder = ROOT / ".lab4-cache/nltk"
    folder.mkdir(parents=True, exist_ok=True)
    nltk.data.path.insert(0, str(folder))
    for resource in ["punkt_tab", "stopwords", "wordnet"]:
        category = "tokenizers" if resource == "punkt_tab" else "corpora"
        available = (folder / category / resource).exists() or (folder / category / f"{resource}.zip").exists()
        if not available and not nltk.download(resource, download_dir=str(folder), quiet=True):
            raise RuntimeError(f"Could not download NLTK resource: {resource}")
    stop_words = set(stopwords.words("english"))
    lemmatizer = WordNetLemmatizer()

    def preprocess(text):
        text = text.lower()
        text = re.sub(r"https?://\S+|www\.\S+", " URL ", text)
        text = re.sub(r"@\w+", " USER ", text)
        text = re.sub(r"\b\d+(?:\.\d+)?\b", " NUMBER ", text)
        return " ".join(lemmatizer.lemmatize(token) for token in word_tokenize(text)
                        if token.isalpha() and token not in stop_words)

    df["text_clean"] = df.tweet_text.map(preprocess)
    counts = CountVectorizer(min_df=2, max_df=0.90)
    dtm = counts.fit_transform(df.text_clean)
    vectorizer = TfidfVectorizer(min_df=2, max_df=0.90)
    tfidf = vectorizer.fit_transform(df.text_clean)
    assert np.array_equal(counts.get_feature_names_out(), vectorizer.get_feature_names_out())
    save_npz(DATA / "lab4_dtm.npz", dtm)
    save_npz(DATA / "lab4_tfidf.npz", tfidf)
    terms = vectorizer.get_feature_names_out()
    pd.DataFrame({"term": terms, "document_frequency": np.asarray((dtm > 0).sum(axis=0)).ravel(),
                  "mean_tfidf": np.asarray(tfidf.mean(axis=0)).ravel()}).to_csv(DATA / "lab4_vocabulary.csv", index=False)
    df[["record_id"]].to_csv(DATA / "lab4_matrix_rows.csv", index=False)
    report["tfidf_shape"] = list(tfidf.shape)
    report["empty_clean_text_rows"] = int(df.text_clean.eq("").sum())


def add_sentiment(df, batch_size):
    import torch
    from transformers import pipeline
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    local = ROOT / ".lab4-cache/model"
    kwargs = {"model": str(local), "tokenizer": str(local)} if (local / "pytorch_model.bin").exists() else {
        "model": MODEL, "revision": REVISION}
    classifier = pipeline("sentiment-analysis", top_k=None, device=-1, **kwargs)
    predictions = []
    for start in range(0, len(df), batch_size):
        output = classifier(df.sentiment_text.iloc[start:start + batch_size].tolist(),
                            truncation=True, max_length=512, batch_size=batch_size)
        for scores in output:
            scores = {item["label"].capitalize(): float(item["score"]) for item in scores}
            if set(scores) != set(CLASSES):
                raise ValueError(f"Unexpected model labels: {list(scores)}")
            predictions.append(scores)
        if start % (batch_size * 10) == 0 or len(predictions) == len(df):
            print(f"Sentiment: {len(predictions)}/{len(df)}", flush=True)
    for label in CLASSES:
        df[f"sentiment_{label.lower()}"] = [row[label] for row in predictions]
    df["sentiment"] = [max(row, key=row.get) for row in predictions]
    df["sentiment_score"] = df.sentiment_positive - df.sentiment_negative
    df["model_confidence"] = [max(row.values()) for row in predictions]


def export(df, report):
    probability_columns = [f"sentiment_{label.lower()}" for label in CLASSES]
    assert df.record_id.is_unique and df.tweet_text.is_unique and len(df) >= 1000
    assert df[probability_columns].notna().all().all()
    assert np.allclose(df[probability_columns].sum(axis=1), 1, atol=1e-5)
    assert df[probability_columns].ge(0).all().all() and df[probability_columns].le(1).all().all()
    assert df.sentiment_score.between(-1, 1).all()
    columns = ["record_id", "source_tweet_id", "tweet_text_raw", "tweet_text", "text_clean",
               "sentiment_text", "keyword", "location", "disaster_relevance", "annotation_confidence",
               *probability_columns, "sentiment", "sentiment_score", "model_confidence"]
    df[columns].to_csv(DATA / "lab4_clean_tweets.csv", index=False)
    groups = ["Disaster-related", "Not disaster-related"]
    index = pd.MultiIndex.from_product([groups, CLASSES], names=["disaster_relevance", "sentiment"])
    aggregate = df.groupby(["disaster_relevance", "sentiment"]).size().reindex(index, fill_value=0).rename("count").reset_index()
    aggregate["total"] = aggregate.groupby("disaster_relevance")["count"].transform("sum")
    aggregate["proportion"] = aggregate["count"] / aggregate.total
    assert aggregate["count"].sum() == len(df)
    aggregate.to_csv(DATA / "lab4_sentiment_by_relevance.csv", index=False)
    report["sentiment_counts"] = df.sentiment.value_counts().astype(int).to_dict()
    report["mean_sentiment_by_relevance"] = df.groupby("disaster_relevance").sentiment_score.mean().to_dict()
    report["missing_after"] = df[columns].isna().sum().astype(int).to_dict()
    (DATA / "lab4_cleaning_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_analysis(aggregate, report)
    print(aggregate.to_string(index=False), flush=True)
    print("Lab 4 exports validated and saved.", flush=True)


def write_analysis(aggregate, report):
    shares = aggregate.set_index(["disaster_relevance", "sentiment"])["proportion"]
    paragraphs = [
        f"I analyzed a reproducible random sample of {report['sample_rows']:,} tweets from the "
        f"{report['source_rows']:,}-row CrowdFlower/Figure Eight disaster dataset distributed on Kaggle. "
        "The source labels describe disaster relevance, not sentiment. I preserved the original text, "
        "decoded HTML entities, normalized whitespace, removed nonprinting control characters and "
        f"{report['duplicate_clean_text_removed']} repeated texts, excluded ambiguous relevance labels, "
        "and marked missing locations and keywords as unknown. Rounded tweet IDs were retained only "
        "as source metadata; unique annotation IDs identify records.",
        "I used Cardiff NLP’s Twitter RoBERTa sentiment model with lightly normalized mentions and URLs, "
        "preserving punctuation and negation. The largest class probability determines the label; "
        "the numeric score is P(positive) minus P(negative). The stacked bars encode relevance by row, "
        "sentiment by color, and within-group percentage by width. "
        f"Negative predictions account for {shares['Disaster-related', 'Negative']:.1%} of disaster-related "
        f"tweets versus {shares['Not disaster-related', 'Negative']:.1%} of unrelated tweets. "
        f"Positive predictions represent {shares['Disaster-related', 'Positive']:.1%} and "
        f"{shares['Not disaster-related', 'Positive']:.1%}, respectively. These are model estimates, "
        "not ground truth; sarcasm, source encoding artifacts, and the dataset’s keyword-based selection "
        "limit interpretation and generalization to Twitter overall."
    ]
    count = len(" ".join(paragraphs).split())
    assert 100 <= count <= 200, count
    (ROOT / "lab4/analysis.json").write_text(json.dumps({"paragraphs": paragraphs, "word_count": count},
                                                       indent=2, ensure_ascii=False), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample-size", type=int, default=1500)
    parser.add_argument("--seed", type=int, default=401)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    df, report = clean_and_sample(args.sample_size, args.seed)
    print(f"Cleaned {report['source_rows']} source rows; analyzing {len(df)} tweets.", flush=True)
    add_tfidf(df, report)
    add_sentiment(df, args.batch_size)
    export(df, report)


if __name__ == "__main__":
    main()

"""Download the original public CSV and the lab's pinned sentiment model."""
from pathlib import Path
import argparse
import io
import zipfile
import requests

ROOT = Path(__file__).resolve().parents[1]
MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
REVISION = "3216a57f2a0d9c45a2e6c20157c20c49fb4bf9c7"
SOURCE = "https://www.kaggle.com/api/v1/datasets/download/jannesklaas/disasters-on-social-media"


def acquire(model=False):
    destination = ROOT / "data/lab4_raw_tweets.csv"
    if not destination.exists():
        response = requests.get(SOURCE, timeout=120)
        response.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read("socialmedia-disaster-tweets-DFE.csv"))
    if model:
        folder = ROOT / ".lab4-cache/model"
        folder.mkdir(parents=True, exist_ok=True)
        for name in ["config.json", "merges.txt", "pytorch_model.bin",
                     "special_tokens_map.json", "vocab.json"]:
            target = folder / name
            if target.exists():
                continue
            print(f"Downloading {name}...", flush=True)
            temporary = target.with_suffix(target.suffix + ".part")
            offset = temporary.stat().st_size if temporary.exists() else 0
            headers = {"Range": f"bytes={offset}-"} if offset else {}
            with requests.get(f"https://huggingface.co/{MODEL}/resolve/{REVISION}/{name}",
                              headers=headers, stream=True, timeout=(30, 180)) as response:
                response.raise_for_status()
                mode = "ab" if offset and response.status_code == 206 else "wb"
                with temporary.open(mode) as output:
                    for chunk in response.iter_content(1024 * 1024):
                        output.write(chunk)
                temporary.replace(target)
        print("Model ready.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", action="store_true")
    acquire(parser.parse_args().model)

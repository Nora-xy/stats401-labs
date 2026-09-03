from io import BytesIO
from pathlib import Path
import time

import pandas as pd
import requests

DATASET_URL = (
    "https://raw.githubusercontent.com/sidooms/MovieTweetings/"
    "master/latest/movies.dat"
)
HEADERS = {"User-Agent": "STATS401-Lab3-Movie-Project/1.0 (educational use)"}


def download_dataset():
    """Download the public data and retry once after a short delay if needed."""
    for attempt in range(2):
        try:
            response = requests.get(DATASET_URL, headers=HEADERS, timeout=60)
            response.raise_for_status()
            return response.content
        except requests.RequestException as error:
            if attempt == 1:
                raise RuntimeError(f"Could not download the movie data: {error}") from error
            print(f"Request failed ({error}). Retrying in 2 seconds...")
            time.sleep(2)


def main():
    # Each source row contains an ID, a title, and genres separated by ::.
    dataframe = pd.read_csv(
        BytesIO(download_dataset()), sep="::", engine="python",
        names=["movie_id", "title", "genres"], encoding="utf-8"
    ).head(1000)
    dataframe["release_year"] = dataframe["title"].str.extract(r"\((\d{4})\)$")[0]
    dataframe["release_year"] = dataframe["release_year"].fillna("Unknown")
    dataframe["genres"] = dataframe["genres"].fillna("Unknown")

    output_file = Path(__file__).resolve().parents[1] / "data" / "lab3_data.csv"
    output_file.parent.mkdir(exist_ok=True)
    dataframe.to_csv(output_file, index=False)
    print(f"Saved {len(dataframe):,} movie records to {output_file}")


if __name__ == "__main__":
    main()

import requests
from bs4 import BeautifulSoup

url = "https://books.toscrape.com/"

headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0"
}

response = requests.get(
    url,
    headers=headers,
    timeout=10
)

response.raise_for_status()

soup = BeautifulSoup(
    response.text,
    "html.parser"
)

books = soup.select("article.product_pod")

print("Books on page:", len(books))

book = books[0]

title = book.select_one("h3 a")["title"]

print(title)

price = book.select_one(
    ".price_color"
).get_text(strip=True)

print(price)

records = []

for book in books:

    title = book.select_one("h3 a")["title"]

    price_text = book.select_one(
        ".price_color"
    ).get_text(strip=True)

    price = float(
        price_text.replace("脗拢", "")
    )

    records.append({
        "title": title,
        "price": price
    })

print(records[:3])


import pandas as pd

df = pd.DataFrame(records)

print(df.head())

df.to_csv(
    "../data/books.csv",
    index=False
)

df.to_json(
    "../data/books.json",
    orient="records",
    indent=2
)

for page in range(1, 6):

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    print(url)

import requests
from bs4 import BeautifulSoup

records = []

for page in range(1, 6):

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    response = requests.get(
        url,
        timeout=10
    )

    response.raise_for_status()

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    books = soup.select(
        "article.product_pod"
    )

    for book in books:

        title = book.select_one(
            "h3 a"
        )["title"]

        price = book.select_one(
            ".price_color"
        ).get_text(strip=True)

        records.append({
            "title": title,
            "price": price,
            "page": page
        })

print("Total records:", len(records))


# Basic Rate Limiting
import requests
import time

for page in range(1, 6):

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    response = requests.get(
        url,
        timeout=10
    )

    response.raise_for_status()

    print("Downloaded page", page)

    time.sleep(1)
    
# Error Handling
for page in range(1, 6):

    try:

        response = requests.get(
            url,
            timeout=10
        )

        response.raise_for_status()

    except requests.RequestException as error:

        print(
            f"Failed on page {page}:",
            error
        )

        continue

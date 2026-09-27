"""Cache original PDF lines and typography for reproducible passage extraction."""
import argparse
import hashlib
import json
from pathlib import Path

import pdfplumber


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, default=Path(".lab8-cache/source.json"))
    args = parser.parse_args()
    result = {"filename": args.pdf.name, "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(), "pages": []}
    with pdfplumber.open(args.pdf) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            words = page.extract_words(extra_attrs=["fontname", "size"])
            result["pages"].append({"pdf_page": number, "width": page.width, "height": page.height, "text": page.extract_text(), "words": words})
            if number % 50 == 0:
                print(f"Extracted {number}/{len(pdf.pages)} pages", flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {len(result['pages'])} pages to {args.output}")


if __name__ == "__main__":
    main()

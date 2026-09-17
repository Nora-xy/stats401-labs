"""Convert GDP CSV to World > continent > area > country JSON.
Run from any working directory: python lab6/convert_hierarchy.py
Uses only the Python standard library.
"""
import csv
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def convert(source, destination):
    root = {"name": "World", "children": []}
    continents, regions, seen = {}, {}, set()
    with source.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            continent, area, country = (row[key].strip() for key in ("continent", "area", "country"))
            gdp = float(row["gdp_billion_usd"])
            status = row["gdp_status"].strip()
            key = (continent, area, country)
            if not all(key) or not math.isfinite(gdp) or gdp <= 0:
                raise ValueError(f"Invalid country or GDP: {row}")
            if status not in {"Increase", "Unchanged", "Decrease"} or key in seen:
                raise ValueError(f"Invalid status or duplicate country: {row}")
            seen.add(key)
            if continent not in continents:
                continents[continent] = {"name": continent, "children": []}
                root["children"].append(continents[continent])
            region_key = (continent, area)
            if region_key not in regions:
                regions[region_key] = {"name": area, "children": []}
                continents[continent]["children"].append(regions[region_key])
            regions[region_key]["children"].append({"name": country, "gdp": gdp, "status": status})
    if not seen:
        raise ValueError("The input contains no countries")
    destination.write_text(json.dumps(root, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Converted {len(seen)} countries into {destination.name}")


if __name__ == "__main__":
    convert(DATA / "lab6_assignment_gdp.csv", DATA / "lab6_assignment_gdp.json")

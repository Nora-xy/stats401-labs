"""Normalize Natural Earth IDs and keep only properties used by Lab 9."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'data/lab9/world-source.geojson'
geo = json.loads(source.read_text(encoding='utf-8'))
for feature in geo['features']:
    p = feature['properties']
    # ADM0_A3 matches every supplied ISO-3 code and keeps separate map units
    # distinct (ISO_A3_EH repeats AUS for Australian offshore territories).
    iso3 = p['ADM0_A3']
    feature['properties'] = dict(iso3=iso3, name=p['NAME'],
                                 anchor=[p['LABEL_X'], p['LABEL_Y']])
rows = list(csv.DictReader((ROOT / 'data/lab9_gdp_2025_top50.csv').open(encoding='utf-8')))
ids = [f['properties']['iso3'] for f in geo['features']]
assert len(ids) == len(set(ids)), 'Duplicate geographic identifiers'
assert len(rows) == 50 and len({r['iso3'] for r in rows}) == 50
assert not {r['iso3'] for r in rows} - set(ids), 'Unmatched GDP identifiers'
(ROOT / 'data/lab9/world.geojson').write_text(json.dumps(geo, separators=(',', ':')), encoding='utf-8')
print(f'Validated: 50/50 GDP identifiers matched to {len(ids)} geographic features.')

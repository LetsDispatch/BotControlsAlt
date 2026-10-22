"""Export the same city/ZIP/state catalog used by LoadboardScanner master.

Usage: python3 scripts/build-location-catalog.py /path/to/LoadboardScanner [git-ref]
No network requests or Google data are used.
"""
import csv
import io
import json
import pathlib
import re
import subprocess
import sys
import unicodedata

repo = pathlib.Path(sys.argv[1]).resolve()
ref = sys.argv[2] if len(sys.argv) > 2 else "origin/master"
commit = subprocess.check_output(["git", "rev-parse", ref], cwd=repo, text=True).strip()


def source(path):
    return subprocess.check_output(["git", "show", f"{commit}:{path}"], cwd=repo).decode("utf-8-sig")


def normalize(value):
    value = "".join(c for c in unicodedata.normalize("NFD", value.lower()) if unicodedata.category(c) != "Mn")
    return " ".join("".join(c if c.isalnum() else " " for c in value).split())


enum = source("src/LoadBoardScanner.DB/Enums/State.cs")
members = re.findall(r'\[Description\("([^"]+)"\)\]\s*\[Display\(Name = "([^"]+)"\)\]\s*(\w+) = (\d+)', enum)
states = [[code.upper(), name] for name, code, _, number in members if 1 <= int(number) <= 51]
regions_by_id = {key: [code.upper(), name] for name, code, key, number in members if int(number) > 51}
regions = [regions_by_id[key] for key in ["Noea", "Soea", "Miwe", "Sowe", "Nowe", "Sout"]]
valid_states = {code for code, _ in states}
rows = []
seen = set()
city_keys = set()
for name, state, lat, lon, *_ in csv.reader(io.StringIO(source("src/LoadBoardScanner.UI/uscities.csv"))):
    name, state = name.strip(), state.strip().upper()
    if state not in valid_states or (name, state) in seen:
        continue
    latitude, longitude = float(lat), float(lon)
    if latitude == 0 or longitude == 0:
        continue
    rows.append([name, state, latitude, longitude])
    seen.add((name, state))
    city_keys.add((normalize(name), state))

zip_aliases = {}
for line in source("src/LoadBoardScanner.UI/US.txt").splitlines():
    fields = line.split("\t")
    if len(fields) < 5:
        continue
    zipcode, name, state = fields[1].strip(), fields[2].strip(), fields[4].strip().upper()
    key = (normalize(name), state)
    if zipcode.isdigit() and key in city_keys:
        zip_aliases.setdefault(key, set()).add(zipcode)
for row in rows:
    row.append(sorted(zip_aliases.get((normalize(row[0]), row[1]), [])))

catalog = {"version": 1, "sourceCommit": commit, "states": states, "regions": regions, "cities": rows}
target = pathlib.Path(__file__).resolve().parents[1] / "locations" / "catalog.v1.json"
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Exported {len(rows)} cities, {len(states)} states/DC and {len(regions)} regions ({target.stat().st_size:,} bytes).")

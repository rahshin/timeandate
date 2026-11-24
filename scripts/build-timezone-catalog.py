"""Build the bundled timezone catalog from local GeoNames downloads."""

import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import unicodedata
from zipfile import ZipFile


MIN_POPULATION = 100_000
CITY_EXCEPTIONS = {4975802}  # Portland, Maine


def rows(content):
    return (line.split("\t") for line in content.splitlines() if line and not line.startswith("#"))


def normalize(name):
    return " ".join(
        "".join(char for char in unicodedata.normalize("NFKD", name.lower())
                if not unicodedata.combining(char)).replace("_", " ").split()
    )


def latin_alias(name):
    letters = [char for char in name if char.isalpha()]
    return bool(letters) and all("LATIN" in unicodedata.name(char, "") for char in letters)


def write_json(path, value, **options):
    path.write_text(json.dumps(value, ensure_ascii=False, **options) + "\n", encoding="utf-8")


def build(source, snapshot_date, output):
    paths = {name: source / name for name in (
        "cities15000.zip", "countryInfo.txt", "admin1CodesASCII.txt"
    )}
    countries = {row[0]: row[4] for row in rows(paths["countryInfo.txt"].read_text(encoding="utf-8"))}
    regions = {row[0]: row[1] for row in rows(paths["admin1CodesASCII.txt"].read_text(encoding="utf-8"))}
    with ZipFile(paths["cities15000.zip"]) as archive:
        cities = list(rows(archive.read("cities15000.txt").decode("utf-8")))
    counts = Counter((normalize(row[1]), row[8]) for row in cities)

    records = []
    for row in sorted(cities, key=lambda row: int(row[0])):
        city_id, name, ascii_name, alternate_names = row[:4]
        country, admin = row[8], row[10]
        if not row[17] or (int(row[14]) < MIN_POPULATION and int(city_id) not in CITY_EXCEPTIONS):
            continue
        region = regions.get(f"{country}.{admin}", "") if counts[normalize(name), country] > 1 else ""
        seen = {normalize(name), normalize(ascii_name), ""}
        aliases = []
        for alias in sorted(alternate_names.split(",")):
            key = normalize(alias)
            if key in seen or len(alias) > 48 or not latin_alias(alias):
                continue
            seen.add(key)
            aliases.append(alias)
        records.append([
            int(city_id), name, countries.get(country, country), region, row[17], int(row[14]),
            ascii_name if normalize(name) != normalize(ascii_name) else "", *aliases,
        ])

    lines = (json.dumps(record, ensure_ascii=False, separators=(",", ":")) for record in records)
    (output / "cities.json").write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")
    write_json(output / "snapshot.json", {
        "format": 1,
        "snapshotDate": snapshot_date,
        "cityCount": len(records),
        "sha256": {name: sha256(path.read_bytes()).hexdigest() for name, path in paths.items()},
    }, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory with the three downloaded GeoNames files")
    parser.add_argument("snapshot_date", help="Download date in YYYY-MM-DD format")
    args = parser.parse_args()
    build(args.source, args.snapshot_date, Path(__file__).resolve().parents[1] / "src" / "timezone-catalog")

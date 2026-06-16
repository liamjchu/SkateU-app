#!/usr/bin/env python3
"""Build a consolidated CSV of US K-12 schools and colleges.

The script uses only the Python standard library. It can download known public
government ZIP endpoints, and it can also parse manually downloaded NCES/IPEDS
CSV or ZIP files placed in the input directory.
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_DATA_DIR = Path("data") / "school_sources"
DEFAULT_OUTPUT = Path("all_us_schools.csv")
DOWNLOAD_TIMEOUT_SECONDS = 90

SOURCE_URLS = {
    # K-12 and postsecondary coordinates: NCES EDGE geocode files.
    # EDGE geocodes are based on CCD, PSS, and IPEDS source collections.
    "edge_public_2024_25": "https://nces.ed.gov/programs/edge/data/EDGE_GEOCODE_PUBLICSCH_2425.zip",
    "edge_private_2023_24": "https://nces.ed.gov/programs/edge/data/EDGE_GEOCODE_PRIVATESCH_2324.zip",
    "edge_postsecondary_2024_25": "https://nces.ed.gov/programs/edge/data/EDGE_GEOCODE_POSTSECSCH_2425.zip",
    # Private K-12 fallback: NCES Private School Universe Survey (PSS).
    # As of June 15, 2026, NCES says 2023-24 PSS is being finalized; 2021-22
    # is the latest CSV file publicly listed on the PSS data page.
    "pss_private_2021_22": "https://nces.ed.gov/surveys/pss/zip/pss2122_pu_csv.zip",
    # Higher education: IPEDS institutional characteristics header/directory.
    "ipeds_higher_ed_2024": "https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip",
    "ipeds_higher_ed_2023": "https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip",
}

MANUAL_DOWNLOAD_URLS = [
    "CCD public schools: https://nces.ed.gov/ccd/files.asp",
    "PSS private schools: https://nces.ed.gov/surveys/pss/pssdata.asp",
    "IPEDS complete files: https://nces.ed.gov/ipeds/use-the-data/download-access-database",
]

OUTPUT_COLUMNS = ["name", "city", "state", "latitude", "longitude", "type"]
US_STATES = {
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
}

SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to"}
KNOWN_ACRONYMS = {"AP", "CTE", "ESL", "GED", "IB", "II", "III", "IV", "STEM", "UCLA", "USC"}
NAME_ALIASES = (
    "SCH_NAME",
    "SCHNAM",
    "SCHOOL_NAME",
    "SCHOOL NAME",
    "INSTNM",
    "INSTITUTION NAME",
    "PINST",
    "NAME",
)
CITY_ALIASES = ("LCITY", "CITY", "SCHOOL_CITY", "SCHOOL CITY", "ADDRCITY", "ADDR_CITY", "PCITY", "PL_CIT")
STATE_ALIASES = ("LSTATE", "STATE", "STABBR", "STATE_ABBR", "SCHOOL_STATE", "SCHOOL STATE", "PSTABB", "PL_STABB")
LATITUDE_ALIASES = ("LATCOD", "LATITUDE", "LAT", "LATITUDE83", "LATITUDE22", "Y")
LONGITUDE_ALIASES = ("LONCOD", "LONGITUD", "LONGITUDE", "LON", "LNG", "LONGITUDE83", "LONGITUDE22", "X")


@dataclass(frozen=True)
class SourceFile:
    name: str
    content: bytes


@dataclass(frozen=True)
class SchoolRecord:
    name: str
    city: str
    state: str
    latitude: str
    longitude: str
    type: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download/parse NCES CCD, NCES PSS, and IPEDS school datasets into all_us_schools.csv."
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--download",
        action="store_true",
        help="Attempt direct downloads from known public government ZIP endpoints before parsing local files.",
    )
    parser.add_argument(
        "--manual-urls",
        action="store_true",
        help="Print official download pages and exit.",
    )
    return parser.parse_args()


def download_sources(data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)

    for key, url in SOURCE_URLS.items():
        destination = data_dir / f"{key}.zip"
        if destination.exists():
            print(f"Already downloaded: {destination}")
            continue

        print(f"Downloading {key}...")
        request = Request(url, headers={"User-Agent": "SkateU school data importer"})
        try:
            with urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
                destination.write_bytes(response.read())
            print(f"Saved {destination}")
        except (HTTPError, URLError, TimeoutError) as error:
            print(f"Could not download {url}: {error}", file=sys.stderr)


def iter_source_files(data_dir: Path) -> Iterable[SourceFile]:
    if not data_dir.exists():
        return

    for path in sorted(data_dir.iterdir()):
        if path.suffix.lower() == ".zip":
            yield from read_zip(path)
        elif path.suffix.lower() in {".csv", ".txt", ".tsv"}:
            yield SourceFile(path.name, path.read_bytes())


def read_zip(path: Path) -> Iterable[SourceFile]:
    try:
        with zipfile.ZipFile(path) as archive:
            for member in archive.namelist():
                suffix = Path(member).suffix.lower()
                if suffix in {".csv", ".txt", ".tsv"}:
                    yield SourceFile(f"{path.name}/{member}", archive.read(member))
    except zipfile.BadZipFile:
        print(f"Skipping invalid ZIP file: {path}", file=sys.stderr)


def parse_source_file(source: SourceFile) -> list[SchoolRecord]:
    edge_records = parse_edge_pipe_file(source)
    if edge_records is not None:
        return edge_records

    text = decode_bytes(source.content)
    sample = text[:4096]
    delimiter = "\t" if source.name.lower().endswith(".tsv") else sniff_delimiter(sample)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    if not reader.fieldnames:
        return []

    field_map = build_field_map(reader.fieldnames)
    source_type = infer_source_type(source.name, field_map)

    if source_type is None:
        return []

    required = [field_map.name, field_map.city, field_map.state, field_map.latitude, field_map.longitude]
    if any(column is None for column in required):
        print(f"Skipping {source.name}: missing one of name/city/state/coordinates", file=sys.stderr)
        return []

    records: list[SchoolRecord] = []
    for row in reader:
        record = clean_record(
            row,
            source_type,
            field_map.name,
            field_map.city,
            field_map.state,
            field_map.latitude,
            field_map.longitude,
        )
        if record:
            records.append(record)

    print(f"Parsed {len(records):,} rows from {source.name} as {source_type}")
    return records


@dataclass(frozen=True)
class FieldMap:
    name: str | None
    city: str | None
    state: str | None
    latitude: str | None
    longitude: str | None


def build_field_map(fieldnames: list[str]) -> FieldMap:
    normalized = {normalize_header(field): field for field in fieldnames}
    return FieldMap(
        name=find_column(normalized, NAME_ALIASES),
        city=find_column(normalized, CITY_ALIASES),
        state=find_column(normalized, STATE_ALIASES),
        latitude=find_column(normalized, LATITUDE_ALIASES),
        longitude=find_column(normalized, LONGITUDE_ALIASES),
    )


def find_column(normalized: dict[str, str], aliases: tuple[str, ...]) -> str | None:
    for alias in aliases:
        field = normalized.get(normalize_header(alias))
        if field:
            return field
    return None


def normalize_header(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def infer_source_type(source_name: str, field_map: FieldMap) -> str | None:
    lower_name = source_name.lower()
    name_column = (field_map.name or "").upper()

    if "edge_geocode_publicsch" in lower_name:
        return "k12_public"
    if "edge_geocode_privatesch" in lower_name:
        return "k12_private"
    if "edge_geocode_postsecsch" in lower_name:
        return "higher_ed"
    if "ipeds" in lower_name or "hd202" in lower_name or name_column == "INSTNM":
        return "higher_ed"
    if "pss" in lower_name:
        return "k12_private"
    if "ccd" in lower_name or "sch_029" in lower_name:
        return "k12_public"

    return None


def parse_edge_pipe_file(source: SourceFile) -> list[SchoolRecord] | None:
    lower_name = source.name.lower()

    if not lower_name.endswith(".txt") or "edge_geocode_" not in lower_name:
        return None

    if "publicsch" in lower_name:
        source_type = "k12_public"
        name_index = 2
        city_index = 5
        state_index = 6
        latitude_index = 12
        longitude_index = 13
    elif "postsecsch" in lower_name:
        source_type = "higher_ed"
        name_index = 1
        city_index = 3
        state_index = 4
        latitude_index = 10
        longitude_index = 11
    else:
        return None

    records: list[SchoolRecord] = []
    text = decode_bytes(source.content)

    for line in text.splitlines():
        row = line.strip().split("|")
        needed_index = max(name_index, city_index, state_index, latitude_index, longitude_index)
        if len(row) <= needed_index:
            continue

        name = clean_name(row[name_index])
        city = clean_name(row[city_index])
        state = row[state_index].strip().upper()
        latitude = clean_coordinate(row[latitude_index])
        longitude = clean_coordinate(row[longitude_index])

        if not name or not city or state not in US_STATES or latitude is None or longitude is None:
            continue

        records.append(
            SchoolRecord(
                name=name,
                city=city,
                state=state,
                latitude=latitude,
                longitude=longitude,
                type=source_type,
            )
        )

    print(f"Parsed {len(records):,} rows from {source.name} as {source_type}")
    return records


def clean_record(
    row: dict[str, str],
    school_type: str,
    name_column: str | None,
    city_column: str | None,
    state_column: str | None,
    latitude_column: str | None,
    longitude_column: str | None,
) -> SchoolRecord | None:
    if not all([name_column, city_column, state_column, latitude_column, longitude_column]):
        return None

    name = clean_name(row.get(name_column, ""))
    city = clean_name(row.get(city_column, ""))
    state = row.get(state_column, "").strip().upper()
    latitude = clean_coordinate(row.get(latitude_column, ""))
    longitude = clean_coordinate(row.get(longitude_column, ""))

    if not name or not city or state not in US_STATES or latitude is None or longitude is None:
        return None

    return SchoolRecord(
        name=name,
        city=city,
        state=state,
        latitude=latitude,
        longitude=longitude,
        type=school_type,
    )


def clean_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value.replace("\x00", "")).strip()
    value = value.strip('"').strip("'")

    if not value:
        return ""

    words = value.lower().split(" ")
    cleaned_words = []
    for index, word in enumerate(words):
        cleaned_words.append(clean_word(word, index))

    return " ".join(cleaned_words)


def clean_word(word: str, index: int) -> str:
    if not word:
        return word

    bare = re.sub(r"[^a-z0-9]", "", word).upper()
    if bare in KNOWN_ACRONYMS:
        return word.upper()

    if index > 0 and word in SMALL_WORDS:
        return word

    if "-" in word:
        return "-".join(clean_word(part, index) for part in word.split("-"))

    if "'" in word:
        return "'".join(part.capitalize() for part in word.split("'"))

    return word.capitalize()


def clean_coordinate(value: str) -> str | None:
    value = value.strip()
    if not value or value in {"-1", "-2", "M", "N", "NA", "N/A"}:
        return None

    try:
        coordinate = float(value)
    except ValueError:
        return None

    if coordinate == 0 or coordinate < -180 or coordinate > 180:
        return None

    return f"{coordinate:.6f}".rstrip("0").rstrip(".")


def decode_bytes(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def sniff_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",\t|").delimiter
    except csv.Error:
        return ","


def dedupe_records(records: Iterable[SchoolRecord]) -> list[SchoolRecord]:
    deduped: dict[tuple[str, str, str, str], SchoolRecord] = {}

    for record in records:
        key = (
            record.name.upper(),
            record.city.upper(),
            record.state,
            record.type,
        )
        deduped[key] = record

    return sorted(deduped.values(), key=lambda item: (item.state, item.city, item.name, item.type))


def write_output(records: list[SchoolRecord], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True) if output_path.parent != Path(".") else None

    with output_path.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "name": record.name,
                    "city": record.city,
                    "state": record.state,
                    "latitude": record.latitude,
                    "longitude": record.longitude,
                    "type": record.type,
                }
            )


def print_manual_urls() -> None:
    print("Official public download pages:")
    for url in MANUAL_DOWNLOAD_URLS:
        print(f"- {url}")
    print()
    print(f"Place downloaded CSV/TXT/ZIP files in: {DEFAULT_DATA_DIR}")


def main() -> int:
    args = parse_args()

    if args.manual_urls:
        print_manual_urls()
        return 0

    if args.download:
        download_sources(args.data_dir)

    records: list[SchoolRecord] = []
    for source in iter_source_files(args.data_dir):
        records.extend(parse_source_file(source))

    if not records:
        print("No school records were parsed.", file=sys.stderr)
        print_manual_urls()
        return 1

    clean_records = dedupe_records(records)
    write_output(clean_records, args.output)
    print(f"Wrote {len(clean_records):,} schools to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

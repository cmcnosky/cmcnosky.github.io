#!/usr/bin/env python3
"""Prepare a public-safe catalog from an owner-approved, normalized UTF-8 CSV."""
import argparse
import csv
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlsplit

BASE = Path(__file__).resolve().parent
MAX_AGE = timedelta(hours=6)
FIELDS = ("id", "status", "title", "description", "category", "brand", "size",
          "condition", "image", "images", "price", "currency", "listed_at", "ebay", "poshmark", "mercari")
REQUIRED_HEADERS = set(FIELDS) - {"brand", "size", "condition", "image", "images", "price", "currency", "listed_at"}
TEXT_MAX = {"id": 96, "title": 240, "description": 30000, "category": 100, "brand": 160,
            "size": 80, "condition": 360}
LINKS = {
    "ebay": ({"www.ebay.com", "ebay.com", "www.ebay.ca", "ebay.ca"}, r"/itm/(?:[-a-zA-Z0-9_%+.~]+/)?([0-9]{10,15})/?", "https://www.ebay.com/itm/"),
    "poshmark": ({"poshmark.com", "www.poshmark.com"}, r"/listing/([-a-zA-Z0-9_%+.~]*[a-fA-F0-9]{24})/?", "https://poshmark.com/listing/"),
    "mercari": ({"mercari.com", "www.mercari.com"}, r"/us/item/(m[0-9]{8,16})/?", "https://www.mercari.com/us/item/"),
}
NO_EXPORT = {"sold", "ended", "inactive", "draft", "unavailable", "out of stock", "reserved"}

def timestamp(value: str) -> datetime:
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    return date.astimezone(timezone.utc)

def iso(date: datetime) -> str:
    return date.isoformat(timespec="seconds").replace("+00:00", "Z")

def clean_url(value, marketplace):
    if len(value) > 2000 or not value.startswith("https://") or re.search(r"[\s\\]", value):
        raise ValueError(f"invalid {marketplace} item link")
    u = urlsplit(value)
    hosts, itempath, prefix = LINKS[marketplace]
    match = re.fullmatch(itempath, u.path)
    if u.scheme != "https" or u.netloc.lower() not in hosts or not match:
        raise ValueError(f"invalid {marketplace} item link")
    return prefix + match.group(1) + ("/" if marketplace == "mercari" else "")

def image_path(value, root):
    if not value.startswith("assets/catalog/") or not re.fullmatch(r"assets/catalog/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,110}\.(?:jpe?g|png|webp|avif)", value, re.I):
        raise ValueError("image must be an approved local JPEG, PNG, WebP or AVIF in assets/catalog/")
    image = root / value
    asset_dir = (root / "assets/catalog").resolve()
    if (not image.is_file() or not asset_dir.is_relative_to(root.resolve())
            or not image.resolve().is_relative_to(asset_dir)):
        raise ValueError("approved local product image is missing")
    return value

def row_to_item(row, root):
    item = {}
    for key, limit in TEXT_MAX.items():
        value = row.get(key, "")
        if len(value) > limit:
            raise ValueError(f"{key} exceeds {limit} characters")
        if not value and key in {"id", "title", "description", "category"}:
            raise ValueError(f"missing {key}")
        if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", value):
            raise ValueError(f"{key} contains a control character")
        if value:
            item[key] = value
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]*", item["id"]):
        raise ValueError("id must be a stable, public-safe SKU")
    links = {m: clean_url(row[m], m) for m in LINKS if row.get(m)}
    if not links:
        raise ValueError("no verified active marketplace link")
    item["links"] = links
    if row.get("image"):
        item["image"] = image_path(row["image"], root)
    if row.get("images"):
        paths = row["images"].split("|")
        if len(paths) > 24:
            raise ValueError("too many product photos (maximum 24)")
        item["images"] = list(dict.fromkeys(image_path(path.strip(), root) for path in paths))
        if "image" not in item:
            item["image"] = item["images"][0]
    if row.get("price"):
        p = row["price"]
        if row.get("currency") != "USD" or not re.fullmatch(r"[0-9]{1,6}(?:\.[0-9]{1,2})?", p) or Decimal(p) <= 0:
            raise ValueError("price must be positive USD (leave blank when channel prices differ or cannot be confirmed)")
        item.update(price=float(Decimal(p)), currency="USD")
    if row.get("listed_at"):
        item["listedAt"] = iso(timestamp(row["listed_at"]))
    return item

def prepare(src, snapshot, root, now=None):
    now = now or datetime.now(timezone.utc)
    if not now - MAX_AGE < snapshot <= now:
        raise ValueError("source snapshot is too old or dated in the future; obtain a fresh export, not a new timestamp")
    items, seen_ids, seen_links = [], set(), set()
    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, strict=True)
        cols = reader.fieldnames or []
        if len(set(cols)) != len(cols) or not REQUIRED_HEADERS.issubset(cols):
            raise ValueError("missing or duplicate normalized headers: " + ", ".join(sorted(REQUIRED_HEADERS - set(cols))))
        for line, raw in enumerate(reader, start=2):
            try:
                if None in raw or any(value is None for value in raw.values()):
                    raise ValueError("invalid number of columns")
                row = {field: raw.get(field, "").strip() for field in FIELDS}
                status = row["status"].casefold()
                if status in NO_EXPORT:
                    continue
                if status != "active":
                    raise ValueError("missing or unknown stock status")
                item = row_to_item(row, root)
                key = item["id"].casefold()
                identities = {(market, url[-24:].lower() if market == "poshmark" else url)
                              for market, url in item["links"].items()}
                if key in seen_ids or not identities.isdisjoint(seen_links):
                    raise ValueError("duplicate SKU or marketplace item URL; reconcile the rows")
                seen_ids.add(key)
                seen_links.update(identities)
                items.append(item)
            except (ValueError, InvalidOperation) as error:
                raise ValueError(f"CSV record {line}: {error}") from None
    return {"updatedAt": iso(snapshot), "items": items}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("csv", type=Path)
    p.add_argument("--as-of", required=True, help="actual seller export snapshot with timezone, not today's publish time")
    p.add_argument("--output", type=Path, default=BASE / "catalog.json")
    args = p.parse_args()
    try:
        prepared = prepare(args.csv, timestamp(args.as_of), args.output.parent)
        temp = args.output.with_suffix(".json.tmp")
        temp.write_text(json.dumps(prepared, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        temp.replace(args.output)
        print(f"Prepared {len(prepared['items'])} active items")
    except (OSError, ValueError, csv.Error) as e:
        print(str(e), file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())

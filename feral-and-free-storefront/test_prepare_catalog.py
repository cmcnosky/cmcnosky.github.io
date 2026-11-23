import csv
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from prepare_catalog import FIELDS, prepare

NOW = datetime(2026, 11, 23, 3, tzinfo=timezone.utc)
BASE_ITEM = {
    "id": "sample-1", "status": "active", "title": "Test cotton shirt",
    "description": "Text on two lines.\nWash cold.", "category": "Clothing",
    "ebay": "https://www.ebay.com/itm/test/100000000001?tracking=strip-me",
    "poshmark": "https://poshmark.com/listing/Fictional-shirt-000000000000000000000001",
    "price": "12.50", "currency": "USD", "cogs": "PRIVATE-123", "notes": "PRIVATE-456",
}

class CatalogTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.src = self.root / 'export.csv'

    def run_prepare(self, *rows, snapshot=NOW):
        with self.src.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=(*FIELDS, "cogs", "notes"))
            writer.writeheader()
            writer.writerows(rows)
        return prepare(self.src, snapshot, self.root, now=NOW)

    def test_export_whitelist_and_filter(self):
        result = self.run_prepare(BASE_ITEM, dict(BASE_ITEM, id="sample-2", status="sold"))
        self.assertEqual(len(result["items"]), 1)
        item = result["items"][0]
        self.assertEqual(item["price"], 12.50)
        self.assertEqual(item["description"], BASE_ITEM["description"])
        self.assertEqual(item["links"]["ebay"], "https://www.ebay.com/itm/100000000001")
        self.assertNotIn("PRIVATE-", repr(result))

    def test_reject_duplicate_listing(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.run_prepare(BASE_ITEM, dict(BASE_ITEM, id="sample-2"))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.run_prepare(BASE_ITEM, dict(BASE_ITEM, id="sample-2", ebay="",
                             poshmark="https://poshmark.com/listing/New-slug-000000000000000000000001"))

    def test_reject_bad_link(self):
        for url in ("javascript:alert(1)", "https://www.ebay.com@other.example/itm/100000000001",
                    "https://www.ebay.com/str/feralandfree", "https://www.ebay.com:443/itm/100000000001"):
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, "invalid ebay"):
                self.run_prepare(dict(BASE_ITEM, ebay=url))

    def test_reject_stale_or_future(self):
        for snapshot in (NOW - timedelta(hours=6), NOW + timedelta(minutes=3)):
            with self.subTest(snapshot=snapshot), self.assertRaisesRegex(ValueError, "too old|future"):
                self.run_prepare(BASE_ITEM, snapshot=snapshot)

    def test_stock_unknown_never_publishes(self):
        with self.assertRaisesRegex(ValueError, "unknown stock"):
            self.run_prepare(dict(BASE_ITEM, status="unknown"))

    def test_approved_image_path_and_optional_price(self):
        path = self.root / "assets/catalog"
        path.mkdir(parents=True)
        (path / "test.webp").write_bytes(b"test")
        item = self.run_prepare(dict(BASE_ITEM, image="assets/catalog/test.webp", price=""))["items"][0]
        self.assertEqual(item["image"], "assets/catalog/test.webp")
        self.assertNotIn("price", item)
        multi = self.run_prepare(dict(BASE_ITEM, images="assets/catalog/test.webp|assets/catalog/test.webp"))["items"][0]
        self.assertEqual(multi["images"], ["assets/catalog/test.webp"])
        self.assertEqual(multi["image"], "assets/catalog/test.webp")
        with self.assertRaisesRegex(ValueError, "approved local"):
            self.run_prepare(dict(BASE_ITEM, image="https://asset.example/image.jpg"))
        with self.assertRaisesRegex(ValueError, "missing"):
            self.run_prepare(dict(BASE_ITEM, image="assets/catalog/missing.jpg"))

if __name__ == "__main__":
    unittest.main()

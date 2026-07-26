#!/usr/bin/env python3
"""Small fail-closed static check for the no-build GitHub Pages site."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.images: list[tuple[str, str | None]] = []
        self.ids: list[str] = []
        self.lang: str | None = None
        self.title_seen = False
        self._in_title = False
        self._title_text: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "html":
            self.lang = values.get("lang")
        if tag == "title":
            self._in_title = True
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
        if tag == "link" and values.get("href"):
            self.links.append(values["href"])
        if tag == "img":
            self.images.append((values.get("src", ""), values.get("alt")))

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
            self.title_seen = bool("".join(self._title_text).strip())

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_text.append(data)


def local_target(page: Path, href: str) -> Path | None:
    parsed = urlparse(href)
    if parsed.scheme or parsed.netloc or href.startswith(("mailto:", "data:", "#")):
        return None
    raw = unquote(parsed.path)
    if not raw:
        return None
    target = (page.parent / raw).resolve()
    if raw.endswith("/"):
        target /= "index.html"
    return target


def main() -> int:
    errors: list[str] = []
    pages = sorted(ROOT.rglob("*.html"))
    for page in pages:
        parser = Document()
        parser.feed(page.read_text(encoding="utf-8"))
        rel = page.relative_to(ROOT)
        if parser.lang != "en":
            errors.append(f"{rel}: html lang must be en")
        if not parser.title_seen:
            errors.append(f"{rel}: missing nonempty title")
        seen_ids: set[str] = set()
        for element_id in parser.ids:
            if element_id in seen_ids:
                errors.append(f"{rel}: duplicate id #{element_id}")
            seen_ids.add(element_id)
        for src, alt in parser.images:
            if not src:
                errors.append(f"{rel}: image missing src")
            if alt is None or not alt.strip():
                errors.append(f"{rel}: image missing useful alt text: {src}")
        for href in parser.links:
            parsed = urlparse(href)
            if parsed.fragment and not parsed.scheme and not parsed.netloc:
                if parsed.path:
                    target_page = local_target(page, parsed.path)
                    if target_page is not None and target_page.is_dir():
                        target_page /= "index.html"
                else:
                    target_page = page
                if target_page == page and parsed.fragment not in seen_ids:
                    errors.append(f"{rel}: missing local anchor #{parsed.fragment}")
            target = local_target(page, href)
            if target is not None and not target.exists():
                errors.append(f"{rel}: broken local link {href} -> {target.relative_to(ROOT)}")

    logo = ROOT / "nofuckery/assets/nofuckery-ai-logo.png"
    if not logo.is_file():
        errors.append("NoFuckery approved logo missing")

    if errors:
        print("SITE CHECK FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"SITE CHECK PASSED: {len(pages)} HTML pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())

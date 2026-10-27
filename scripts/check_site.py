#!/usr/bin/env python3
"""Small fail-closed static check for the no-build GitHub Pages site."""

from __future__ import annotations

import hashlib
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_HOST = "cmcnosky.github.io"
PRIMARY_RESUME_NAME = "Chris McNosky Resume.pdf"
PRIMARY_RESUME = ROOT / "why-hire" / PRIMARY_RESUME_NAME
RESUME_ALIASES = (
    ROOT / "why-hire" / "chris-mcnosky-resume.pdf",
    ROOT / "why-hire" / "assets" / "Chris-McNosky-Grafana-Contribution.pdf",
    ROOT / "why-hire" / "assets" / "Chris-McNosky-Selected-Contributions.pdf",
    ROOT / "why-hire" / "assets" / "Chris-McNosky-Tokio-Contribution.pdf",
)
CLEARGRAIN_ROOT = ROOT / "cleargrain"
CLEARGRAIN_ASSETS = (
    CLEARGRAIN_ROOT / "assets" / "cleargrain-docs-mark.png",
    CLEARGRAIN_ROOT / "assets" / "cleargrain-docs-social.png",
)
LEGACY_REDIRECTS = {
    ROOT / "nofuckery" / "index.html": "/cleargrain/",
    ROOT / "nofuckery" / "corrections" / "index.html": "/cleargrain/corrections/",
    ROOT / "nofuckery" / "evidence" / "claude-hawk" / "index.html": "/cleargrain/evidence/claude-hawk/",
    ROOT / "nofuckery" / "evidence" / "control-notes" / "index.html": "/cleargrain/evidence/control-notes/",
    ROOT / "nofuckery" / "evidence" / "current-record" / "index.html": "/cleargrain/evidence/current-record/",
    ROOT / "nofuckery" / "evidence" / "evaluation-graph" / "index.html": "/cleargrain/evidence/evaluation-graph/",
    ROOT / "nofuckery" / "evidence" / "forecast-accuracy" / "index.html": "/cleargrain/evidence/forecast-accuracy/",
    ROOT / "nofuckery" / "evidence" / "methods" / "index.html": "/cleargrain/evidence/methods/",
    ROOT / "nofuckery" / "evidence" / "stinger-c04" / "index.html": "/cleargrain/evidence/stinger-c04/",
}


class Document(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.anchors: list[tuple[str, bool, str | None]] = []
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
            href = values["href"]
            self.links.append(href)
            self.anchors.append((href, "download" in values, values.get("download")))
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
    if parsed.scheme and parsed.scheme not in {"http", "https"}:
        return None
    if parsed.netloc and parsed.hostname != SITE_HOST:
        return None
    if href.startswith("#"):
        return None
    raw = unquote(parsed.path)
    if not raw:
        if not parsed.netloc:
            return None
        raw = "/"
    if parsed.netloc or raw.startswith("/"):
        target = (ROOT / raw.lstrip("/")).resolve()
    else:
        target = (page.parent / raw).resolve()
    if raw.endswith("/"):
        target /= "index.html"
    return target


def main() -> int:
    errors: list[str] = []
    resume_files = (PRIMARY_RESUME, *RESUME_ALIASES)
    resume_hashes: dict[Path, str] = {}
    for resume_file in resume_files:
        if not resume_file.is_file():
            errors.append(f"missing résumé file: {resume_file.relative_to(ROOT)}")
            continue
        resume_hashes[resume_file] = hashlib.sha256(resume_file.read_bytes()).hexdigest()
    if PRIMARY_RESUME in resume_hashes:
        primary_hash = resume_hashes[PRIMARY_RESUME]
        for alias in RESUME_ALIASES:
            if alias in resume_hashes and resume_hashes[alias] != primary_hash:
                errors.append(
                    f"résumé alias differs from primary: {alias.relative_to(ROOT)}"
                )

    for asset in CLEARGRAIN_ASSETS:
        if not asset.is_file():
            errors.append(f"missing Cleargrain brand asset: {asset.relative_to(ROOT)}")

    retired_public_paths = (
        ROOT / "nofuckery" / "assets",
        ROOT / "nofuckery" / "nofuckery.css",
        ROOT / "nofuckery" / "evidence" / "current-record" / "records.json",
    )
    for retired_path in retired_public_paths:
        if retired_path.exists():
            errors.append(f"retired public brand asset remains: {retired_path.relative_to(ROOT)}")

    forbidden_brand_terms = ("No" + "Fuckery", "No " + "Fuckery", "NF" + "AI")
    current_text_files = [ROOT / "README.md"]
    for suffix in ("*.html", "*.json", "*.css", "*.svg"):
        current_text_files.extend(sorted(ROOT.rglob(suffix)))
    for current_file in current_text_files:
        text = current_file.read_text(encoding="utf-8")
        for forbidden_term in forbidden_brand_terms:
            if forbidden_term.casefold() in text.casefold():
                errors.append(
                    f"retired public brand remains in {current_file.relative_to(ROOT)}"
                )

    cleargrain_pages = sorted(CLEARGRAIN_ROOT.rglob("index.html"))
    if len(cleargrain_pages) != 9:
        errors.append(f"expected 9 Cleargrain HTML routes, found {len(cleargrain_pages)}")
    archive_notice = "republished this technical record on October 27, 2026"
    for cleargrain_page in cleargrain_pages:
        if archive_notice not in cleargrain_page.read_text(encoding="utf-8"):
            errors.append(
                f"missing Cleargrain archive provenance: {cleargrain_page.relative_to(ROOT)}"
            )

    for redirect_page, destination in LEGACY_REDIRECTS.items():
        if not redirect_page.is_file():
            errors.append(f"missing legacy redirect: {redirect_page.relative_to(ROOT)}")
            continue
        redirect_text = redirect_page.read_text(encoding="utf-8")
        if 'name="robots" content="noindex, follow"' not in redirect_text:
            errors.append(f"legacy redirect must be noindex: {redirect_page.relative_to(ROOT)}")
        if destination not in redirect_text:
            errors.append(
                f"legacy redirect target mismatch: {redirect_page.relative_to(ROOT)}"
            )

    primary_resume_links = 0
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
            if target is not None and not target.is_relative_to(ROOT):
                errors.append(f"{rel}: local link escapes site root: {href}")
                continue
            if target is not None and not target.exists():
                errors.append(f"{rel}: broken local link {href} -> {target.relative_to(ROOT)}")
        for href, has_download, download_name in parser.anchors:
            target = local_target(page, href)
            if target in RESUME_ALIASES:
                errors.append(
                    f"{rel}: active résumé link must use {PRIMARY_RESUME_NAME}: {href}"
                )
            if target == PRIMARY_RESUME:
                primary_resume_links += 1
                if has_download and download_name != PRIMARY_RESUME_NAME:
                    errors.append(
                        f"{rel}: résumé download filename must be {PRIMARY_RESUME_NAME}"
                    )

    if primary_resume_links == 0:
        errors.append(f"no active link to primary résumé: why-hire/{PRIMARY_RESUME_NAME}")

    if errors:
        print("SITE CHECK FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"SITE CHECK PASSED: {len(pages)} HTML pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())

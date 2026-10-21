# Chris McNosky · Project portfolio

[Live portfolio](https://cmcnosky.github.io/) · [Career profile and résumé](https://cmcnosky.github.io/why-hire/) · [GitHub profile](https://github.com/cmcnosky)

A static portfolio for technical project delivery, software quality, full-stack
web development, and software verification. Project entries link to live applications,
source code, tests, and evidence records.

## Featured work

- **Read Shruti:** a released author website using Next.js, TypeScript, Cloudflare Workers, and D1.
- **Stinger:** a Python CLI and reusable GitHub Actions workflow for software-integrity evaluation.
- **Tokio contribution:** a Rust feature approved and merged upstream on October 21, 2026, resolving a five-year-old E-hard request. Conditional `select!` branches are filtered before storage and polling generation, with regression coverage and measured responses to maintainer review. [PR #8374](https://github.com/tokio-rs/tokio/pull/8374) records the implementation, tests, approval, and merge.
- **Grafana contribution:** a merged ShortURL compatibility fix that uses the authenticated organization ID for non-Cloud response links, omits `orgId` in Grafana Cloud, and preserves configured application subpaths.
- **WASP 2.0:** Rust/Python trading-system research with documented order-safety and readiness controls.

## Local preview

No build step is required. From a clone of this repository:

```sh
python3 -m http.server 8731
```

Open <http://localhost:8731>. Before publishing, run the static integrity check:

```sh
python3 scripts/check_site.py
```

The check inspects HTML titles, language attributes, duplicate IDs, local links,
image alternative text, résumé-link naming, and byte-identical résumé aliases.
Review the rendered pages as well.

## Repository map

| Path | Purpose |
|---|---|
| `index.html`, `style.css` | Main portfolio and its styles |
| `why-hire/` | Career profile, three-page résumé with contribution evidence, and social-preview image |
| `nofuckery/` | Technical evidence briefs, methods, corrections, and supporting assets |
| `scripts/check_site.py` | Static page-integrity checks |

The former lowercase résumé path and three legacy contribution-PDF paths remain
byte-identical aliases of `why-hire/Chris McNosky Resume.pdf` so previously
shared links continue to open the same current document.

GitHub Pages publishes the root of `main`. After a change, verify the Pages build
and the rendered live page.

# Chris McNosky · Project portfolio

[Live portfolio](https://cmcnosky.github.io/) · [Career profile and résumé](https://cmcnosky.github.io/why-hire/) · [GitHub profile](https://github.com/cmcnosky)

A static portfolio for full stack web development, AI evaluation, and agent
reliability work. Project entries link to live applications, source code, tests,
and evidence records.

## Featured work

- **Read Shruti:** a released author website built with Next.js, TypeScript, Cloudflare Workers, and D1.
- **Stinger:** a Python CLI and reusable GitHub Actions workflow for coding-agent integrity evaluation.
- **Tokio contribution:** a submitted Rust implementation of conditional `select!` branches, with regression tests.
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
and image alternative text. Review the rendered pages as well.

## Repository map

| Path | Purpose |
|---|---|
| `index.html`, `style.css` | Main portfolio and its styles |
| `why-hire/` | Career profile, résumé download, and social-preview image |
| `nofuckery/` | Technical evidence briefs, methods, corrections, and supporting assets |
| `scripts/check_site.py` | Static page-integrity checks |

GitHub Pages publishes the root of `main`. After a change, verify the Pages build
and the rendered live page.

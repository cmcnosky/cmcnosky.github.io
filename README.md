# cmcnosky.github.io

The personal site. Live at **https://cmcnosky.github.io**

## How to change it

Two files, no build step, no dependencies. Edit, commit, push — the live site updates in
about a minute.

| File | What's in it |
|---|---|
| `index.html` | **All the words.** Edit this to change any copy. |
| `style.css` | Shared design. |
| `nofuckery/` | NoFuckery AI evidence, methods, corrections, and public assets. |

```sh
git add -A && git commit -m "update copy" && git push
```

## Preview locally before pushing

```sh
python3 -m http.server 8731
```

Then open <http://localhost:8731>. Opening `index.html` directly by double-clicking works too,
but some browsers won't load the stylesheet that way — use the command above if it looks unstyled.

Run the static integrity check before publishing:

```sh
python3 scripts/check_site.py
```

## Not done yet

- **`og:image`** — the social preview card currently shows title and description text but no image.
  Adding a 1200×630 PNG at the repo root and pointing `og:image` at it makes shared links look
  deliberate instead of bare.
- **Custom domain** — if `chrismcnosky.com` gets registered: add a file named `CNAME` containing
  just `chrismcnosky.com`, point the DNS at GitHub Pages, then update the `og:url` meta tag.

# Reason Engine Website v0.1

Static, dependency-free preview for `reasonengine.de`.

## Status

- Design and copy: draft
- Public deployment: not performed
- Custom domain: not connected
- Contact address: not verified
- Legal pages: incomplete placeholders
- Search indexing: blocked with `noindex` and `robots.txt`

## Preview locally

Run a local static server from this directory:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Files

- `index.html`: one-page public entrance
- `styles.css`: responsive design without external fonts or frameworks
- `script.js`: mobile navigation and header state
- `assets/`: self-contained SVG artwork
- `impressum.html`: incomplete legal placeholder
- `datenschutz.html`: incomplete privacy placeholder
- `404.html`: custom not-found page

## Before publication

1. Replace all legal placeholders with verified information.
2. Configure and verify `kontakt@reasonengine.de` or another public address.
3. Select hosting and complete the privacy notice for that host.
4. Remove `noindex,nofollow` and update `robots.txt` only after approval.
5. Test all pages on mobile and desktop.
6. Connect `reasonengine.de`; redirect `reasonengine.org` only after DNS verification.
7. Do not claim customer results, runtime enforcement, or production readiness without evidence.

## Design principles

- stable core, wild edges
- structure without forced navigation
- documentary credibility instead of generic AI spectacle
- no tracking, cookie banners, external fonts, or JavaScript frameworks in v0.1
- hidden inspiration may be discovered but never blocks a task

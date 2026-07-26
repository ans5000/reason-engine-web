# Reason Engine Website

Public, static and dependency-free entrance for `reasonengine.de`.

## Current status

- Public deployment: active through GitHub Pages
- Custom domain: `reasonengine.de` connected through `CNAME`
- Main role: personal public project, research and pilot entrance
- Atlas: public but unindexed local browser prototype under `/app/`
- Study application page: published as an explicitly pre-product pilot concept
- Legal pages: present for the current GitHub Pages setup
- Search indexing: allowed on the public entrance and Study page; Atlas remains `noindex,nofollow`
- Analytics and tracking: none in the repository code
- Public contact: existing Gmail address; a domain mailbox is not yet claimed
- Product maturity: no production readiness, model integration or customer results claimed

## Public files

- `index.html`: primary public project and pilot entrance
- `app/`: local Atlas interaction prototype without model API or server database
- `study.html`: first concrete application branch for university students
- `homepage-v0.5.css`: shared responsive visual system
- `homepage-v0.5.js`: mobile navigation, header state, image fallbacks and reveal behavior
- `robots.txt`: permits crawling and points to the sitemap
- `sitemap.xml`: public index of the main and Study entrances; Atlas is intentionally omitted
- `assets/`: self-contained project images and marks
- `impressum.html`: legal notice
- `datenschutz.html`: privacy notice for the current technical setup
- `404.html`: custom not-found page

## Local preview

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Truth boundaries

The public site may describe architectural intentions, planned applications and bounded pilots. It must not present a planned interface as an implemented product, claim runtime enforcement without verification, invent customer results or imply that a payment is available before a real checkout and defined deliverable exist.

The Atlas prototype may claim only what its browser implementation and automated acceptance test demonstrate. It currently stores inputs in localStorage, uses no model API, has no server database and invalidates user confirmation when a confirmed entry is edited. Loading the static app still requires a normal connection to GitHub Pages; “local” refers to user-entered Atlas data, not to the delivery of the website itself.

## Design principles

- stable core, wild edges
- documentary credibility instead of generic AI spectacle
- a strong thought, a simple sentence, a concrete example
- no tracking, external fonts or JavaScript frameworks
- final verification at the public handoff, not only in repository state

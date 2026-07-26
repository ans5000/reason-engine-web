# Reason Engine Website

Public, static and dependency-free entrance for `reasonengine.de`.

## Current status

- Public deployment: active through GitHub Pages
- Custom domain: `reasonengine.de` connected through `CNAME`
- Main role: personal public project, research and pilot entrance
- Atlas: public, local browser alpha under `/app/`; no accounts, cloud storage or model API
- Study application page: published as an explicitly pre-product pilot concept
- Legal pages: present for the current GitHub Pages setup
- Search indexing: allowed on the public entrance and Study page; Atlas remains `noindex,nofollow`
- Analytics and tracking: none in the repository code
- Public contact: existing Gmail address; a domain mailbox is not yet claimed
- Product maturity: no production readiness or customer results claimed

## Public files

- `index.html`: primary public project and pilot entrance
- `study.html`: first concrete application branch for university students
- `app/`: public Atlas alpha with browser-local workspaces, JSON backup and no model API
- `homepage-v0.5.css`: shared responsive visual system
- `homepage-v0.5.js`: mobile navigation, header state, image fallbacks and reveal behavior
- `robots.txt`: permits crawling and points to the sitemap
- `sitemap.xml`: public index of the main and Study entrances; Atlas is intentionally omitted
- `assets/`: self-contained project images and marks
- `impressum.html`: legal notice
- `datenschutz.html`: privacy notice for the current technical setup
- `404.html`: custom not-found page

## Atlas truth boundary

Atlas v0.3.1 is a usable browser prototype, not a production application.

- Data is stored only in the current browser through `localStorage`.
- Users can export and import a JSON backup.
- Clearing browser data can destroy unsaved local workspaces.
- Editing a checked entry automatically removes its checked status.
- Imported JSON never carries checked status into the new local library; imported entries must be reviewed again.
- “Checked” means correctly captured by the user, not proven true.
- No account, cloud database, model API or automatic truth enforcement exists.
- Personal, medical and other sensitive data must not be entered.

## Local preview

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Truth boundaries

The public site may describe architectural intentions, implemented prototypes, planned applications and bounded pilots. It must distinguish those states explicitly, never claim runtime enforcement without verification, invent customer results or imply that a payment is available before a real checkout and defined deliverable exist.

## Design principles

- stable core, wild edges
- documentary credibility instead of generic AI spectacle
- a strong thought, a simple sentence, a concrete example
- no tracking, external fonts or JavaScript frameworks
- final verification at the public handoff, not only in repository state

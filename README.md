# Reason Engine Website

Public, static and dependency-free entrance for `reasonengine.de`.

## Current status

- Public deployment: active through GitHub Pages
- Custom domain: `reasonengine.de` connected through `CNAME`
- Main role: personal public project, research and pilot entrance
- Atlas: public local browser alpha v0.4.1 under `/app/`; no accounts, cloud storage or model API
- Study application page: published as an explicitly pre-product pilot concept
- Legal pages: present for the current GitHub Pages setup
- Search indexing: allowed on the public entrance and Study page; Atlas remains `noindex,nofollow`
- Analytics and tracking: none in the repository code
- Product maturity: no production readiness or customer results claimed

## Public files

- `index.html`: primary public project and pilot entrance
- `study.html`: first concrete application branch for university students
- `app/`: public Atlas alpha with local workspaces, rule-based topic assignment, contradiction hints, dossier export and JSON backup
- `homepage-v0.5.css`: shared responsive visual system
- `homepage-v0.5.js`: mobile navigation, header state, image fallbacks and reveal behavior
- `robots.txt`: permits crawling and points to the sitemap
- `sitemap.xml`: public index of the main and Study entrances; Atlas is intentionally omitted
- `assets/`: self-contained project images and marks
- `impressum.html`: legal notice
- `datenschutz.html`: privacy notice for the current technical setup

## Atlas truth boundary

Atlas v0.4.1 is a usable browser prototype, not a production application.

- Data is stored only in the current browser through `localStorage`.
- Users can export a Markdown dossier and import/export JSON backups.
- Editing a checked entry removes its checked status.
- Editing or deleting an entry removes contradiction hints whose evidence changed.
- Imported JSON never transfers checked status or contradiction hints as trusted state.
- “Checked” means correctly captured by the user, not proven true.
- Clearing browser data can destroy unsaved local workspaces.
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

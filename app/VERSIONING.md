# Atlas versioning

Atlas uses separate version numbers for separate promises.

## App release

The public interface is **Atlas v0.7.0**.

This release makes the Reason Engine a visible city guide inside the territorial field map:

- the problem remains the central hex field,
- six clarification districts form the first ring,
- every conversation input immediately creates a separate filled hex,
- new hexes are placed next to the active district when a free neighboring slot exists,
- the guide continuously exposes location, destination, route, gate, blocker and status,
- relationships remain explicit roads,
- field type, district and truth state remain separate,
- possible contradictions remain lexical review hints,
- the Markdown decision dossier includes the guide state.

These functions are heuristics. They are not semantic AI, factual verification, autonomous planning or a guarantee that a contradiction or blocker is real.

## Data schema

The local Atlas library and individual Atlas records continue to use **schema v0.3**.

Atlas v0.7 adds optional `district`, `districtKey`, `createdAt` and `guide` metadata. Existing v0.3 records remain valid; missing guide state is reconstructed locally from the current fields and clarification step.

Schema v0.3 uses typed fields with axial hex coordinates (`q`, `r`) and explicit routes. Existing v0.1 and v0.2 browser data is migrated locally when first opened.

## Backup format

The backup format remains v0.3. Native field records preserve optional v0.7 metadata when exported. Import accepts current field backups and earlier node-based exports. A missing city-guide state is reconstructed after import.

## Public-alpha status

The app is publicly reachable but intentionally carries `noindex,nofollow` during this alpha stage. It is not yet promoted through search engines.

## Integrity boundary

The history is append-only in normal interface behavior. This is not a cryptographic guarantee. Browser data and exported files can be changed outside the interface.

The city guide is a derived navigation aid, not an autonomous authority. Its route and blocker labels are generated from the current local Atlas state and remain user-correctable.

The decision dossier is a derived local export. It reflects the current browser state and is not signed, hashed or independently verified.

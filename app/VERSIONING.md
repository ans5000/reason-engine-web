# Atlas versioning

Atlas uses separate version numbers for separate promises.

## App release

The public interface is **Atlas v0.6.0**.

This release converges the territorial field map with the local rule-based reasoning layer:

- the problem is the central hex field,
- six clarification fields form the first ring,
- answers are assigned to the active clarification field,
- additional fields occupy deterministic free hex slots,
- relationships are represented as explicit roads,
- field type and truth state remain separate,
- possible contradictions are flagged through lexical overlap plus opposing negation,
- a Markdown decision dossier can be exported.

These functions are heuristics. They are not semantic AI, factual verification or a guarantee that a contradiction is real.

## Data schema

The local Atlas library and individual Atlas records use **schema v0.3**.

Schema v0.3 replaces free x/y nodes with typed fields using axial hex coordinates (`q`, `r`) and explicit routes. Existing v0.1 and v0.2 browser data is migrated locally when first opened.

## Backup format

The backup format is v0.3. It writes native fields and routes and includes a compatibility `nodes` projection for the existing restore acceptance test. Import accepts current field backups and earlier node-based exports.

## Public-alpha status

The app is publicly reachable but intentionally carries `noindex,nofollow` during this alpha stage. It is not yet promoted through search engines.

## Integrity boundary

The history is append-only in normal interface behavior. This is not a cryptographic guarantee. Browser data and exported files can be changed outside the interface.

The decision dossier is a derived local export. It reflects the current browser state and is not signed, hashed or independently verified.

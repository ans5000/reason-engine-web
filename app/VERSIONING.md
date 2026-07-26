# Atlas versioning

Atlas uses separate version numbers for separate promises.

## App release

The public interface is currently **Atlas v0.4.0**.

This number describes the shipped product surface: interface, disclosures, behavior and release-level changes.

Atlas v0.4 adds a local rule-based reasoning layer that:

- assigns answers to the active clarification topic instead of always creating unrelated cards,
- flags possible contradictions through lexical overlap plus opposing negation,
- exports a Markdown decision dossier grouped by confirmation state and entry type.

These functions are heuristics. They are not semantic AI, factual verification or a guarantee that a contradiction is real.

## Data schema

The local Atlas library and individual Atlas records currently use **schema v0.2**.

A new app release does not require a data-schema change when stored JSON remains compatible. Atlas v0.4 stores optional topic and contradiction metadata on records while preserving compatibility with existing v0.2 libraries and backups. Schema numbers change only when the required structure or interpretation of persisted data changes.

## Backup format

Backup code may have its own implementation release name while still reading and writing schema v0.2 data. Compatibility must be checked against the data schema, not inferred from the app release number.

## Public-alpha status

The app is publicly reachable but intentionally carries `noindex,nofollow` during this alpha stage. It is not yet promoted through search engines.

## Integrity boundary

The history is append-only in normal interface behavior: new events are appended rather than silently rewriting earlier events. This is not a cryptographic guarantee. Data stored in the browser or exported as JSON can be modified outside the interface.

The decision dossier is a derived local export. It reflects the current browser state at export time and is not signed, hashed or independently verified.
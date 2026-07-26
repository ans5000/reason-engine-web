# Atlas versioning

Atlas uses separate version numbers for separate promises.

## App release

The public interface is currently **Atlas v0.5.0**.

This number describes the shipped product surface: interface, disclosures, behavior and release-level changes.

Atlas v0.5 changes the spatial grammar from a radial node diagram to a growing hex landscape:

- the root problem occupies the central hex,
- existing clarification spaces remain visible as surrounding fields,
- every submitted conversation entry creates a new, automatically filled hex,
- new hexes are assigned to the active clarification district,
- the map expands in a deterministic honeycomb spiral,
- newly created hexes receive a short arrival animation.

Atlas v0.5 retains the local rule-based reasoning layer from v0.4. Topic assignment, entry classification and contradiction hints remain heuristics. They are not semantic AI, factual verification or a guarantee that a contradiction is real.

## Data schema

The local Atlas library and individual Atlas records currently use **schema v0.2**.

A new app release does not require a data-schema change when stored JSON remains compatible. Atlas v0.5 stores optional `district` and `createdAt` metadata on new records while preserving compatibility with existing v0.2 libraries and backups. Older records without these fields remain renderable as hexes.

## Backup format

Backup code may have its own implementation release name while still reading and writing schema v0.2 data. Compatibility must be checked against the data schema, not inferred from the app release number.

## Public-alpha status

The app is publicly reachable but intentionally carries `noindex,nofollow` during this alpha stage. It is not yet promoted through search engines.

## Integrity boundary

The history is append-only in normal interface behavior: new events are appended rather than silently rewriting earlier events. This is not a cryptographic guarantee. Data stored in the browser or exported as JSON can be modified outside the interface.

The decision dossier is a derived local export. It reflects the current browser state at export time and is not signed, hashed or independently verified.
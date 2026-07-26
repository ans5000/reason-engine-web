# Atlas versioning

Atlas uses separate version numbers for separate promises.

## App release

The public interface is currently **Atlas v0.3.1**.

This number describes the shipped product surface: interface, disclosures, behavior and release-level changes.

## Data schema

The local Atlas library and individual Atlas records currently use **schema v0.2**.

A new app release does not require a data-schema change when stored JSON remains compatible. Schema numbers change only when the structure or interpretation of persisted data changes.

## Backup format

Backup code may have its own implementation release name while still reading and writing schema v0.2 data. Compatibility must be checked against the data schema, not inferred from the app release number.

## Public-alpha status

The app is publicly reachable but intentionally carries `noindex,nofollow` during this alpha stage. It is not yet promoted through search engines.

## Integrity boundary

The history is append-only in normal interface behavior: new events are appended rather than silently rewriting earlier events. This is not a cryptographic guarantee. Data stored in the browser or exported as JSON can be modified outside the interface.

# Atlas versioning

Atlas uses separate version numbers for separate promises.

## App release

The public interface is **Atlas v0.8.1**.

Atlas v0.8 retains the city-guide field map and adds an object-centred Reason tool layer:

- the problem remains the central hex field,
- every conversation input creates a separate filled field,
- the guide exposes location, destination, route, gate, blocker and status,
- Deep Dive, Ka-Tet, Audit, Pilot and Sources create local follow-up fields,
- Relation connects distant fields through the visible Reason network,
- field type, district and truth state remain separate.

Atlas v0.8.1 adds a narrow Truth Gate at the two places where authority could otherwise become stale or forged:

- changing a checked or decided field resets it to provisional,
- confirmation provenance and derived verification metadata are removed after semantic edits,
- JSON imports keep content, coordinates and routes but do not transfer checked or decided authority,
- imported authority resets are disclosed and appended to the local history,
- the visible confirmed-state label is rendered as `geprüft`.

These functions are local interface rules. They are not semantic AI, factual verification, autonomous planning or a cryptographic trust system.

## Data schema

The local Atlas library and individual Atlas records continue to use **schema v0.3**.

Atlas v0.8.1 does not require a schema migration. Existing v0.3 records remain valid. The Truth Gate changes how checked state is invalidated at edit and import boundaries, not the required record structure.

Schema v0.3 uses typed fields with axial hex coordinates (`q`, `r`) and explicit routes. Existing v0.1 and v0.2 browser data is migrated locally when first opened.

## Backup format

The backup format remains v0.3. Native field records preserve compatible field, route, guide and tool metadata. Import accepts current field backups and earlier node-based exports. Content and topology are restored, while non-root checked and decided states require renewed local review.

## Public-alpha status

The app is publicly reachable but intentionally carries `noindex,nofollow` during this alpha stage. It is not yet promoted through search engines.

## Integrity boundary

The history is append-only in normal interface behavior. This is not a cryptographic guarantee. Browser data and exported files can be changed outside the interface.

The city guide and Reason tools are derived navigation and reasoning aids, not autonomous authorities. Their labels and generated fields remain user-correctable.

The Truth Gate prevents two specific forms of silent status drift inside the interface. It does not make browser storage or export files tamper-proof.

Any dossier or JSON export reflects the current local browser state and is not signed, hashed or independently verified.

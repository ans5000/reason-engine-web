# Atlas App public alpha v0.6.0

Browser-only Reason Engine field-map prototype.

## Interaction model

- A problem becomes the central hex field.
- Six clarification fields form the first ring.
- Conversation answers fill active fields without silently confirming them.
- New fields occupy deterministic free hex slots.
- Relationships are represented as explicit roads.
- Field type and truth state are separate.
- Possible contradictions are rule-based review hints.
- A local Markdown decision dossier and JSON backups can be exported.
- Every structural change is recorded in an append-only interface history.
- Existing v0.1 and v0.2 browser data is migrated to schema v0.3.

## Boundaries

- No model API
- No account or server database
- Browser localStorage only
- No data transmission
- No personal, patient or production data
- `noindex,nofollow`

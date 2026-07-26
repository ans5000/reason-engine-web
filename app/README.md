# Atlas App Prototype v0.3

Browser-only Reason Engine field-map prototype.

## Interaction model

- A problem becomes the central hex field.
- Six primary fields form the first ring.
- Conversation answers fill fields without silently confirming them.
- New fields occupy the next free hex slot.
- Relationships are represented as explicit roads.
- Fields have separate semantic types and truth states.
- Every structural change is recorded in an append-only local history.
- Existing v0.1 and v0.2 browser data is migrated to v0.3.

## Boundaries

- No model API
- No account or server database
- Browser localStorage only
- No data transmission
- No personal, patient or production data
- `noindex,nofollow`

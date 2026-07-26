# Atlas App public alpha v0.7.0

Browser-only Reason Engine field-map prototype with a visible city-guide layer.

## Interaction model

- A problem becomes the central hex field.
- Six clarification districts form the first ring.
- Every conversation input immediately creates its own filled hex.
- New hexes are placed next to the active district whenever space is available.
- The city guide continuously shows location, destination, route, gate, blocker and status.
- Field type, district and truth state remain separate.
- Relationships are represented as explicit roads.
- Possible contradictions are rule-based review hints.
- A local Markdown decision dossier includes the current city-guide state.
- JSON backups and the append-only interface history remain available.
- Existing v0.1 and v0.2 browser data is migrated to schema v0.3.

## Boundaries

- No model API
- No semantic factual verification
- No account or server database
- Browser localStorage only
- No data transmission
- No personal, patient or production data
- `noindex,nofollow`

# Asset Handoff v0.5

Die Messaging- und Layout-Revision verwendet die beiden bereits ausgewählten Originalbilder. Die Motive werden nicht neu generiert, umkomponiert oder umbenannt.

## Zielpfade im Repository

Die Dateien können exakt unter ihren vorhandenen Namen in den Ordner `assets` hochgeladen werden:

```text
assets/reason-engine-hero-original.jpg
assets/reason-engine-system-depth-original.jpg
```

## Integritätswerte

```text
reason-engine-hero-original.jpg
SHA-256: 388abbc93e2b1b8ecdaa7a4ae96db563acd01c8d164037b12cae4b2fbb307055
Dimensions: 1448 × 1086

reason-engine-system-depth-original.jpg
SHA-256: 7e5ce371e628fce6bf9b6cb0968b716d024cab920425430deb5237e4a5313e87
Dimensions: 1122 × 1402
```

## Laufzeitverhalten

`homepage-v0.5.js` lädt bevorzugt genau diese beiden Dateien. Solange eine Datei noch fehlt, bleibt das vorhandene Repository-Bild als technisch intakter Fallback sichtbar.

## Regel

Das Hero-Motiv wird nicht neu generiert, nicht umkomponiert und nicht durch ein ähnliches Bild ersetzt. Das abstrakte Motiv bleibt ein eigenständiges Bild im Manifestabschnitt.

Merge und Deployment bleiben bis zur abschließenden Sichtprüfung blockiert.

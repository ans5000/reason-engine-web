# Asset Handoff v0.5

Die Messaging- und Layout-Revision verwendet zwei bereits ausgewählte Originalbilder. Die binären Bilddateien werden getrennt vom GitHub-Connector übergeben, weil dieser Schreibpfad nur UTF-8-Textdateien anlegen kann.

## Zielpfade

```text
assets/hero-library-original.jpg
assets/system-depth-original.jpg
```

## Integritätswerte

```text
hero-library-original.jpg
SHA-256: 388abbc93e2b1b8ecdaa7a4ae96db563acd01c8d164037b12cae4b2fbb307055
Dimensions: 1448 × 1086

system-depth-original.jpg
SHA-256: 7e5ce371e628fce6bf9b6cb0968b716d024cab920425430deb5237e4a5313e87
Dimensions: 1122 × 1402
```

## Regel

Das Hero-Motiv wird nicht neu generiert, nicht umkomponiert und nicht durch ein ähnliches Bild ersetzt. Das abstrakte Motiv bleibt ein eigenständiges Bild im Manifestabschnitt.

Bis beide Dateien an den Zielpfaden liegen, verwendet die Branch-Vorschau die vorhandenen Repository-Bilder als technisch intakten Fallback.

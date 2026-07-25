# Asset Handoff v0.5

Die Messaging- und Layout-Revision verwendet zwei bereits ausgewählte Originalbilder. Die Motive wurden nicht neu generiert oder umkomponiert. Für die Website liegen zusätzlich verlustbehaftet weboptimierte Ableitungen derselben Originale vor.

## Zielpfade im Repository

```text
assets/hero-library-original.webp
assets/system-depth-original.webp
```

## Originaldateien

```text
hero-library-original.jpg
SHA-256: 388abbc93e2b1b8ecdaa7a4ae96db563acd01c8d164037b12cae4b2fbb307055
Dimensions: 1448 × 1086

system-depth-original.jpg
SHA-256: 7e5ce371e628fce6bf9b6cb0968b716d024cab920425430deb5237e4a5313e87
Dimensions: 1122 × 1402
```

## Weboptimierte Ableitungen

```text
hero-library-original.webp
SHA-256: 18b7db3baf0a6bafd606b36ebe3cfdb5af31b3379f9ad60e3c145c1c2d77daeb
Dimensions: 1448 × 1086
WebP quality: 72

system-depth-original.webp
SHA-256: 1710b5326290d8de42529680277f5d6b0c5a649359fd6874c8da4ecd75d9bbe8
Dimensions: 1122 × 1402
WebP quality: 72
```

## Übergabequellen

Die weboptimierten Dateien wurden am 25. Juli 2026 in Google Drive abgelegt:

- Hero: https://drive.google.com/file/d/1EX_wEYR8EcKHuleTTvZbt6sBPl1qu4hr/view?usp=drivesdk
- Manifestbild: https://drive.google.com/file/d/1WT1csClpm_pP1tS-51lNhh34h460HLsT/view?usp=drivesdk

Diese Links dienen ausschließlich der binären Übergabe. Sie sollen nicht als externe Bildquellen in der öffentlichen Website eingebunden werden.

## Regel

Das Hero-Motiv wird nicht neu generiert, nicht umkomponiert und nicht durch ein ähnliches Bild ersetzt. Das abstrakte Motiv bleibt ein eigenständiges Bild im Manifestabschnitt.

Bis beide Dateien als echte Repository-Assets an den Zielpfaden liegen, verwendet die Branch-Vorschau die vorhandenen Repository-Bilder als technisch intakten Fallback. Merge und Deployment bleiben bis dahin blockiert.

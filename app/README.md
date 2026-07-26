# Atlas Public Alpha v0.3.1

Öffentlicher, statischer Reason-Engine-Prototyp unter `/app/`.

## Funktionen

- mehrere Atlanten im lokalen Browser speichern
- bestehende v0.1-Daten automatisch übernehmen
- Atlas-Einträge manuell anlegen, bearbeiten, einordnen und löschen
- Einträge als vom Nutzer korrekt erfasst markieren
- diese Markierung nach jeder Inhalts- oder Typänderung automatisch wieder aufheben
- importierte Bestätigungsstatus grundsätzlich verwerfen und erneut prüfen lassen
- chronologische lokale Änderungsspur je Atlas
- einzelne Atlanten sowie die gesamte Bibliothek als JSON sichern
- JSON-Sicherungen begrenzt und normalisiert importieren

## Präzise Grenzen

- keine Modell-API und keine echte KI
- keine Serverdatenbank, Konten oder Cloud-Synchronisation
- Eingaben werden nur in `localStorage` dieses Browsers gespeichert
- die statischen App-Dateien werden von GitHub Pages geladen
- Browserdaten sind kein verlässliches Backup
- „geprüft“ bedeutet, dass der Nutzer Inhalt und Einordnung als korrekt erfasst bestätigt hat, nicht dass eine Aussage objektiv wahr ist
- eine importierte Datei ist keine vertrauenswürdige Bestätigungsquelle
- der lokale Verlauf wird zusammen mit einem gelöschten Atlas entfernt und ist daher nicht unveränderlich
- keine Produktiv-, Personen-, Patienten- oder vertraulichen Daten verwenden

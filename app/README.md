# Atlas App Prototype v0.3

Lokaler, statischer Reason-Engine-Prototyp unter `/app/`.

## v0.3

- mehrere Atlanten im lokalen Browser speichern
- bestehende v0.1-Daten automatisch übernehmen
- Atlas-Einträge manuell anlegen, bearbeiten, einordnen und löschen
- bestätigte Erfassung nach jeder Inhalts- oder Typänderung automatisch wieder auf „unbestätigt“ setzen
- chronologische lokale Änderungsspur je Atlas
- JSON-Export mit Änderungsspur
- sichtbare Datengrenze und Warnung vor Personen-, Patienten- und vertraulichen Daten

## Präzise Grenzen

- keine Modell-API und keine echte KI
- keine Serverdatenbank oder Cloud-Synchronisation
- Eingaben werden nur in `localStorage` dieses Browsers gespeichert
- die statischen App-Dateien werden normal von GitHub Pages geladen
- der Verlauf ist innerhalb eines bestehenden Atlas chronologisch; beim Löschen des Atlas wird er mit gelöscht
- „geprüft“ bedeutet, dass der Nutzer Inhalt und Einordnung als korrekt erfasst bestätigt hat, nicht dass eine Aussage objektiv wahr ist
- keine Produktiv-, Personen-, Patienten- oder vertraulichen Daten verwenden

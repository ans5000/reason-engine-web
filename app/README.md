# Atlas Public Alpha v0.4.1

Lokaler, statischer Reason-Engine-Prototyp unter `/app/`.

## Funktionen

- mehrere Atlanten im lokalen Browser speichern
- Antworten regelbasiert Klärungsthemen zuordnen
- mögliche Widersprüche als heuristische Prüfhinweise markieren
- Atlas-Einträge anlegen, bearbeiten, einordnen, prüfen und löschen
- Markdown-Entscheidungsdossier sowie JSON-Sicherungen exportieren
- lokale JSON-Sicherungen normalisiert importieren
- chronologische Änderungsspur je Atlas

## Statuswahrheit

- Eine Bearbeitung hebt den bisherigen Prüfstatus des Eintrags auf.
- Eine Bearbeitung oder Löschung entfernt davon abhängige Widerspruchshinweise.
- JSON-Importe übertragen weder Prüfstatus noch Widerspruchshinweise als vertrauenswürdigen Zustand.
- Importierte Themenzuordnung bleibt erhalten, damit Klärungsräume nicht unnötig dupliziert werden.
- „Geprüft“ bedeutet vom Nutzer als korrekt erfasst, nicht objektiv wahr.

## Grenzen

- keine Modell-API und keine echte KI
- keine Serverdatenbank, Konten oder Cloud-Synchronisation
- Eingaben nur in `localStorage` dieses Browsers
- Browserdaten sind kein verlässliches Backup
- Verlauf und Exportdateien sind nicht kryptografisch manipulationssicher
- keine Produktiv-, Personen-, Patienten- oder vertraulichen Daten verwenden

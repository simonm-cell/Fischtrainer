# Anleitung zum Fischtrainer

## Installation auf Android über Chrome

1. Öffne die Adresse der App in Chrome auf dem Handy.
2. Tippe oben rechts auf das Menü (die drei Punkte).
3. Tippe auf **Zum Startbildschirm hinzufügen** oder **App installieren** und bestätige.
4. Starte die App danach über das neue Symbol auf dem Startbildschirm.

## `fischbilder.zip` aufs Handy übertragen und importieren

Die Bilder sind nicht in der App enthalten, sondern kommen aus deiner eigenen Datei `fischbilder.zip`.

1. Übertrage die Datei aufs Handy, zum Beispiel per USB-Kabel in den Ordner **Download**.
2. Öffne die App. Beim ersten Start erscheint **Bilder importieren**. Später findest du das unter **Einstellungen**.
3. Wähle `fischbilder.zip` aus und warte auf die Meldung „67 Bilder importiert“.

Die Bilder werden nur im Browser auf dem Handy gespeichert und nirgendwohin hochgeladen. Danach funktioniert die App auch ohne Internet.

**Bewahre `fischbilder.zip` als Sicherung auf.** Löschst du die App oder die Browserdaten, sind die Bilder im Browser weg und du musst sie neu importieren. Lege die Datei nicht in einen öffentlichen Ordner, und teile sie nicht.

## Nutzung am Computer

Öffne die Adresse der App in Chrome und importiere die Bilder wie oben. Du kannst auch per Tastatur lernen:

| Taste | Wirkung |
|---|---|
| Leertaste | Aufdecken |
| 1 | Gewusst |
| 2 | Nicht gewusst |

Mit der Zurück-Funktion des Browsers oder des Handys kommst du jederzeit zur Startseite. Du machst danach an derselben Stelle weiter.

## Fortschritt zwischen Geräten übertragen

1. Auf dem alten Gerät: **Einstellungen → Fortschritt → Exportieren**. Das speichert eine JSON-Datei.
2. Übertrage die Datei auf das andere Gerät.
3. Auf dem anderen Gerät: **Einstellungen → Fortschritt → Importieren**, dann die Datei auswählen und **Ersetzen** bestätigen.

Der Import ersetzt den Fortschritt auf dem Zielgerät, die Geräte gleichen sich nicht automatisch ab. Lerne also immer mit dem zuletzt importierten Stand weiter. Ein Export ist auch eine gute Sicherung.

## Fischdaten korrigieren

Die Daten stehen in der Datei `fische.json`. Öffne sie auf GitHub oder in einem Texteditor und ändere den Eintrag des Fisches:

| Feld | Bedeutung |
|---|---|
| `id` | Eindeutiger Schlüssel. **Nicht ändern**, weil Fortschritt und Bild daran hängen. |
| `name` | Name auf der Karte |
| `mindestmass_cm` | Zahl ohne Anführungszeichen, zum Beispiel `50`, oder `null` für „kein Mindestmaß“ |
| `schonzeit` | Text in Anführungszeichen oder `null` für „keine Schonzeit“ |
| `hinweis` | Text oder `""` für keinen Hinweis |
| `quelle`, `stand` | Link und Stand der Quelle |

Achte auf die Kommas und Anführungszeichen. Ist die Datei fehlerhaft, zeigt die App eine Fehlermeldung statt der Karten. Ein neuer Fisch bekommt einen neuen Eintrag mit einer neuen `id` und startet in Fach 1. Sein Bild heißt dann `<id>.jpg`.

Nach der Änderung gehst du vor wie unter „Updates einspielen“.

## Updates einspielen

1. Speichere die geänderten Dateien im GitHub-Repository. GitHub Pages veröffentlicht sie nach etwa einer Minute.
2. Öffne die App mit Internet, schließe sie und öffne sie erneut.

Fortschritt und importierte Bilder bleiben dabei erhalten. Karten werden über ihre `id` zugeordnet.

**Lade nie Bilder oder ZIP-Dateien in das Repository hoch.** Die Datei `.gitignore` schützt dich nur bei Git-Befehlen, nicht beim Hochladen über die GitHub-Webseite.

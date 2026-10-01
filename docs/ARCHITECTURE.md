# Architektur & Entwicklung

## Leitidee

* **Ausgeliefert wird genau eine Datei:** `index.html` (HTML + CSS + JS inline).
  Sie läuft per Doppelklick über `file://`, ohne Server, ohne Installation.
* **Entwickelt wird in Schnipseln:** alles unter `src/`. Der Build setzt daraus
  die eine `index.html` zusammen.
* **`index.html` ist generiert.** Nicht direkt bearbeiten – Änderungen gehen
  verloren, sobald jemand `node build.mjs` ausführt.

```
src/
├─ index.template.html      Gerüst mit Marken: @styles @markup @seed @scripts
├─ styles/                  CSS, eine Datei je Bereich
│  ├─ 00-base.css           Tokens, Reset, Basis
│  ├─ 10-appbar.css         App-Bar (Zeile 1)
│  ├─ 20-toolbar.css        Toolbar (Zeile 2)
│  ├─ 30-locations.css      Standortliste / Progress Rings
│  ├─ 35-cards.css          Kacheln, Blasen, Fortschrittsbalken, Toolbar-Steuerung
│  ├─ 40-views.css          Tabelle & Zeitplan
│  └─ 50-responsive.css     Responsive & Druck
├─ markup/                  statisches HTML
│  ├─ 00-header.html
│  ├─ 10-toolbar.html
│  ├─ 20-filter.html
│  └─ 30-stage.html         main, Fußzeile, Overlays
├─ data/
│  └─ seed.json             eingebauter Testbestand (Fallback ohne daten.js)
└─ js/                      Anwendungslogik, eine Datei je Thema
   ├─ 00-config.js          CONFIG + URL-Optionen
   ├─ 10-dom.js             $ / $$ / esc / Icons
   ├─ 20-util.js            Formatierung, Status, Dialog-Grundlagen
   ├─ 30-model.js           Datenmodell + Export-Mapping (fromExport)
   ├─ 31-data-source.js     Seed, Signatur, Erledigungs-Abgleich
   ├─ 32-store-local.js     Store: lokaler Bestand (localStorage)
   ├─ 33-store-api.js       Store: SQL-Backend (REST)
   ├─ 34-store.js           Store-Auswahl
   ├─ 40-settings.js        Einstellungen & Design
   ├─ 41-state.js           Anwendungszustand
   ├─ 42-selectors.js       Filter, Gruppierung, Kennzahlen
   ├─ 43-actions.js         setView / setGroup / setSort / setBereich / fortschritt
   ├─ 44-presets.js         Presets (Gruppieren+Sortieren+Ansicht), Standard
   ├─ 45-tabs.js            Tabs (benannte Ansichten), Zeitraum-Jahre, Persistenz
   ├─ 50-render.js          Rendering aller Ansichten
   ├─ 60-detail.js          Detailpanel, Anhänge, Combo-Box
   ├─ 70-termin.js          Outlook-/ICS-Disposition
   ├─ 80-dialogs.js         To-Do- und Erledigungs-Dialoge
   ├─ 90-events.js          Event-Verdrahtung
   ├─ 95-debug.js           öffentliche/debug-API (window.WT)
   └─ 99-boot.js            init()
```

## Bauen

```
node build.mjs            # baut index.html
node build.mjs --check    # baut und prüft (JS-Syntax, CSS-Klammern, Marker)
node build.mjs --watch    # baut bei jeder Änderung neu
```

Die **Reihenfolge ergibt sich aus dem Dateinamen** (numerische Präfixe). Ein
neuer Schnipsel wird einfach mit passender Nummer abgelegt – am Build ist
nichts anzupassen. `build.mjs` erzeugt außerdem pro JS-Modul ein eigenes
`<script>` mit `//# sourceURL=src/js/…`. Dadurch zeigt der Browser jede Datei
als **eigene Quelle** in den DevTools, obwohl die Auslieferung eine Datei ist.

## Entwickeln mit Live-Reload

```
node dev.mjs            # http://127.0.0.1:8090
node dev.mjs --open     # zusätzlich Browser öffnen
node dev.mjs --api      # gegen den SQL-Testserver (server.mjs, Port 8080)
```

`dev.mjs` baut, liefert das Projekt aus und lädt den Browser bei Änderungen
unter `src/` automatisch neu. Der Reload-Client wird **nur beim Ausliefern**
eingehängt – die Datei `index.html` bleibt produktionsrein.

## Debugging in der Konsole: `window.WT`

`src/js/95-debug.js` bündelt die nützlichen Zugänge, statt sie im globalen
Namensraum zu verstreuen:

```js
WT.state.items.length        // Daten
WT.dump()                    // Kurzüberblick (Quelle, Zahlen, Ansicht)
WT.setView('plan')           // auf die Zeitplanansicht umschalten
WT.setBereich('todo')        // Bereich wechseln
WT.aktuelleZahlen('alle')    // { alle, over, soon, open, done, mine }
WT.store                     // aktueller Store (LocalStore / ApiStore)
WT.resetCache()              // localStorage-Bestand verwerfen und neu laden
```

## Datenzugriff / Weg zum bestehenden SQL-Backend

Der Datenzugriff ist in zwei austauschbare **Stores** gekapselt. Beide erfüllen
denselben Vertrag:

| Methode | Zweck |
|---|---|
| `load()` | `{ items }` der Wartungspositionen |
| `complete(id, patch)` | Erledigungsfelder einer Position speichern |
| `loadTodos()` / `saveTodo()` / `deleteTodo()` | eigene To-Dos |
| `loadTodos`-Anhänge, `supportsAttachments` | Anhänge (optional) |

`init()` wählt anhand von `CONFIG.dataSource` (`?api=…` oder `?local`) den
Store. Für ein **bestehendes** SQL-Backend ist daher nur ein neuer Store nach
demselben Muster nötig:

1. `src/js/35-store-sql.js` anlegen, Objekt mit obiger Methodenliste exportieren.
2. In `34-store.js` / `init()` (99-boot.js) auswählen.
3. Mapping bleibt zentral in `30-model.js` (`fromExport`): Das Backend liefert
   das flache Arbeitsmodell oder das Export-Format (`site/task/schedule/…`).
4. Schreibzugriffe strikt auf `complete()` (Erledigung) und To-Dos begrenzen –
   Stammdaten pflegt die Administration (siehe `schema.sql`, `server.mjs`).

Nur die UI-Schicht kennt `state.items` als flaches Modell. Diese Trennung macht
einen Backendwechsel zu einer reinen Store-Frage.

## Tests

```
node tests/checks.mjs    # Frontend-Logik ohne Browser (lädt index.html in node:vm)
node tests/api.mjs       # gegen die API (server.mjs muss laufen)
```

`checks.mjs` fügt alle eingebetteten `<script>` der gebauten `index.html`
zusammen und führt sie in `node:vm` aus. Nach Änderungen an `src/` also erst
`node build.mjs`, dann testen.

## Anzeige-Modell: drei Schritte

Die Darstellung wird allein durch vier Felder in `state` gesteuert:

| Feld | Werte |
|---|---|
| `state.group` | `object` · `task` · `status` · `none` |
| `state.view` | `list` · `tiles` · `blobs` |
| `state.sortKey` | `status` · `due` · `object` · `name` |
| `state.sortDir` | `asc` · `desc` |

`groupItems()`, `sortItems()`, `sortGroups()` (Reine Funktionen in
`src/js/42-selectors.js`) erzeugen daraus Gruppen und Reihenfolgen; die Ansichten
in `src/js/50-render.js` rendern Liste, Kacheln oder Blasen. Presets
(`src/js/44-presets.js`) speichern genau diese vier Felder in `localStorage`.
Der Fortschrittsbalken kommt aus `fortschritt()` (`src/js/43-actions.js`).

## Tabs (benannte Ansichten)

`src/js/45-tabs.js` hält eine Liste von Tabs in `localStorage`
(`<storageKey>.tabs`). Drei Standard-Tabs (`all`/`wartung`/`todo`) sind
`builtin` und nicht schließbar; `+` legt eigene Tabs an. Jeder Tab speichert
`TAB_SETTING_KEYS` (Bereich, Status, Suche, Personen, Mine, **Zeitraum**,
Gruppierung, Ansicht, Sortierung). `syncActiveTab()` schreibt den Zustand bei
jedem Rendern zurück, `applyTabState()` stellt ihn wieder her. Favoriten werden
über `orderedTabs()` vorne angepinnt. Der Zeitraumfilter (`zeitraumJahr`, `von`,
`bis`) wirkt in `42-selectors.js`/`zeitraumMatch()` auf die Frist `bis`.

## Konventionen

* Eine Datei = ein Thema; oben ein kurzer Kommentar zum Zweck.
* Keine Build-Abhängigkeiten: nur Node-Bordmittel (`node:fs`, `node:vm`, …).
* Neue Funktionen mit klarem Namen statt „Zustand setzen und `render()`“ verstreut.
* Nicht direkt in `index.html` editieren – immer `src/`.
* Verwaiste Dateien nach `archive/` verschieben (siehe `.gitignore`) statt löschen.

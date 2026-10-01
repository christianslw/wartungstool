# Wartungstool – Technik Außeneinsatz

Web-Frontend für die Ausführung und Protokollierung jährlicher Wartungspunkte.
Ersetzt das alte Visual-Basic-Tool, **ohne dessen Rechteproblem**: Wartungen
werden im Frontend nicht angelegt oder geändert – das macht die Datenbank-
Administration. Eigene To-Dos des Technikers sind bewusst davon getrennt.

```
wartungstool/
├─ index.html          ← GENERIERT: die komplette Anwendung (HTML+CSS+JS in einer Datei)
├─ src/                ← Quelle: Schnipsel für Styles, Markup und JS (nicht index.html editieren!)
├─ build.mjs           ← setzt index.html aus src/ zusammen
├─ dev.mjs             ← Dev-Server mit Live-Reload
├─ daten.js            ← Stammdaten für den Betrieb ohne Server (aus wartungen2026.json)
├─ wartungen2026.json  ← Export der Wartungsaufgaben (Quelle der Stammdaten)
├─ schema.sql          ← SQL-Schema (Wartungen, To-Dos, Anhänge)
├─ server.mjs          ← Testserver: SQLite + REST-API, ohne npm-Abhängigkeiten
├─ start.cmd           ← Doppelklick: Server starten und Browser öffnen
├─ tests/checks.mjs    ← 126 Prüfungen der Frontend-Logik (node tests/checks.mjs)
├─ tests/api.mjs       ← 26 Prüfungen gegen die API (node tests/api.mjs)
├─ docs/ARCHITECTURE.md← Aufbau, Stores, Weg zum bestehenden SQL-Backend
└─ README.md
```

---

## 0. Entwicklung (Quelle in `src/`)

`index.html` ist **generiert** – nicht direkt bearbeiten. Die Anwendung besteht
unter `src/` aus kleinen, thematischen Schnipseln (`src/js/`, `src/styles/`,
`src/markup/`); der Build fügt daraus wieder die eine HTML-Datei zusammen:

```
npm run build          # index.html neu bauen + prüfen (node build.mjs --check)
npm run dev            # Dev-Server mit Live-Reload: http://127.0.0.1:8090
npm test               # Frontend-Prüfungen (node tests/checks.mjs)
```

Im Browser zeigt DevTools jedes Modul dank `//# sourceURL` als **eigene Quelle**;
in der Konsole hilft `WT` (z. B. `WT.dump()`, `WT.setView('plan')`,
`WT.resetCache()`). Details, Modulreihenfolge und der Weg zum bestehenden
SQL-Backend stehen in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 1. Sofort ansehen (ohne Server)

`index.html` per **Doppelklick** öffnen. Kein Build, keine Installation, offline
nutzbar. Gelesen werden die Stammdaten aus `daten.js` (102 Positionen an 15
Standorten); fehlt die Datei, greift der eingebaute Testbestand.

## 2. Mit SQL-Backend

```
start.cmd          →  http://localhost:8080/?api=http://localhost:8080/api
node server.mjs --import            →  Stammdaten neu aus wartungen2026.json einlesen
node server.mjs --import datei.json →  beliebige Exportdatei einlesen
```

---

## 2b. Datenformat

Das Tool versteht **beide** Formate:

* das flache Arbeitsmodell (`objekt_nr`, `taetigkeit`, `bis`, …) und
* den **verschachtelten Export** (`site` / `task` / `schedule` / `execution`,
  ISO-Daten), wie er in `wartungen2026.json` vorliegt.

Beim Einlesen wird u. a. gemappt: `site.id` → `objekt_nr`, `task.activity` →
`taetigkeit`, `schedule.dueDateEnd` → `bis` (ISO → `TT.MM.JJJJ`),
`execution.status` → `erledigt`. Zusätzlich gespeichert: `external_id`,
`hash_key` und `intervall` (z. B. „alle 12 Monate (variabel)").

## 3. Rollentrennung – der Kern der Anwendung

| | Administration (DB/API) | Techniker (Frontend) |
|---|---|---|
| Wartungsposition anlegen/ändern/löschen | ✅ | ❌ nicht vorhanden |
| Positionen ansehen, suchen, filtern | ✅ | ✅ |
| Erledigung + Abschlusskommentar | ✅ | ✅ |
| Anhänge an Wartungen | ✅ | ✅ |
| **Eigene To-Dos** anlegen/ändern/löschen | – | ✅ (sind keine Stammdaten) |

Serverseitig erzwungen: `PUT`/`POST`/`DELETE` auf `/api/items` antworten mit
**HTTP 405**; der Techniker-Endpunkt ist `PATCH /api/items/:id/erledigung` und
akzeptiert nur `erledigt`, `erledigt_am`, `erledigt_durch`, `erledigt_notiz`.
In der Produktion zusätzlich über Spaltenrechte (siehe `schema.sql`).

---

## 4. Bedienung

**Leitidee:** Die App ist ein Arbeitsmittel, kein Datenbrowser. Sie gliedert sich
in **Tabs** (benannte Ansichten), eine **zusammengefasste Steuerung** und einen
**Fortschrittsbalken**:

1. **Titelleiste** (folgt dem Design, hell/dunkel): Programmname · **globale
   Suche** (Taste `/`) · Name · Drucken/Menü
2. **Tab-Leiste**: Start ist **Zuhause** (Landing), dann die Standard-Ansichten
   *Alle · Wartungen · Eigene To-Dos*, daneben **`+`** für eigene Tabs (benennen).
   Jeder Tab merkt sich **seine Filter und Ansicht**; Favoriten (`★`) stehen vorne.
   Rechtsklick auf einen Tab (oder Hover → `⋯`) öffnet *Anpinnen · **Tab speichern** ·
   Umbenennen · Tab schließen*. Über **`+`** lassen sich gespeicherte Tabs wieder
   öffnen (Ablage, max. 5 – wächst nicht endlos).
3. **Ansicht & Filter** – **ein** Knopf öffnet darunter die Leiste mit Status-Pills,
   *Meine*, Personen, Tätigkeit, **Zeitraum** (Jahr + von/bis), den **drei
   Schritten** (Gruppieren · Sortieren · Ansicht) und **Presets**.
4. **Fortschrittsbalken**: Gesamtfortschritt der Wartungen – eigene, sonst alle.

Alle Tabs und Einstellungen werden **clientseitig gespeichert** (`localStorage`)
und bleiben über Sitzungen erhalten.

Die **Standortzeilen** sitzen in einem **festen Spalten-Grid**:

| Spalte | Inhalt |
|---|---|
| 1 | Aufklapp-Pfeil + Objektnummer + Standortname (feste Breite, gekürzt) |
| 2 | Dringlichkeits-Badges (`überfällig`, `bald fällig`, `To-Do`, `abgeschlossen`) – immer an derselben Stelle |
| 3 | Aufgabenübersicht: die nächsten zwei Tätigkeiten als Chips, Rest als `+X weitere` |
| 4 | Fortschritt: Mini-Balken + `erledigt/gesamt` (z. B. `0/33`) |
| 5 | Aktion (Termin) rechtsbündig |

Standorte mit **überfälligen** Positionen bekommen einen **3 px roten linken
Rahmen** (bald fällig: gelb), damit Kritische beim Scrollen sofort auffallen.

Ganz unten, dezent in der Mitte, zeigt eine schmale Fußzeile die **Datenquelle**
(`Stammdaten: daten.js`, `SQL-Backend`, `Offline`) statt prominent im Kopf.

| Aktion | Weg |
|---|---|
| Suchen | Suchfeld oben oder Taste `/` |
| Filtern | Status-Pills, Personen, Tätigkeit, **Zeitraum** (Jahr, von/bis) im Knopf *Ansicht & Filter* |
| **Abhaken** | Kästchen ganz links – Datum, Name und der **Abschlusskommentar** werden abgefragt |
| **Termin disponieren** | Kalender-Symbol in der Zeile **oder im Standortkopf** (pauschaler Termin) |
| Kommentar ändern | „Kommentar" in der Zeile oder Detailleiste (Wartungen) bzw. im To-Do-Dialog |
| Anhänge | Detailleiste der Wartung bzw. im To-Do-Dialog – mit Kommentar je Anhang |
| Details ansehen | Zeile anklicken oder `Enter` |
| Drucken / CSV / JSON | `P` bzw. Menü `⋯` |
| Einstellungen | Menü `⋯` → *Einstellungen* (Design, Terminadresse, eigener Name) |

### Drei Schritte: Gruppieren · Sortieren · Ansicht

| Schritt | Optionen |
|---|---|
| **Gruppieren nach** | Standort · Tätigkeit · Status · Ohne Gruppierung |
| **Sortieren nach** | Status · Frist · Standort (Nr.) · Standort (Name) – jeweils auf-/absteigend (`↑`/`↓`) |
| **Ansicht** | **Liste** · **Kacheln** · **Blobs** (Taste `M` wechselt) |

* **Liste** – Gruppen mit Kopfzeile (Fortschritt, offen/gesamt, Warnhinweise);
  ohne Gruppierung die flache, sortierbare Tabelle.
* **Kacheln** – eine Karte je Gruppe mit **Fortschrittsring, Prozent und
  „X offen · erledigt/gesamt"**. Ideal z. B. gruppiert nach Tätigkeit: eine
  Kachel je Prüfart, man sieht sofort, wie viel noch offen ist. Klick öffnet die
  Positionen der Kachel. Zeigt die aktuelle Auswahl (alle – oder nur offene bei
  gesetztem Statusfilter).
* **Blobs** – ein Kreis je Gruppe: **Größe = Anzahl Positionen**, **Füllung =
  Fortschritt**, Prozent in der Mitte; Klick zeigt die Positionen darunter.

**In allen Ansichten stehen offene Positionen oben**, abgeschlossene Gruppen
unten.

### Tabs, Home & Zeitraum (clientseitig)
Die **Tabs** oben sind benannte Ansichten. **Zuhause** ist die **Landing Page** und
beim Aufruf der Seite aktiv: tageszeitabhängige **Begrüßung mit Vornamen**, darunter
ein Subheader („Es sind noch x von y Wartungen offen … in diesem Jahr verbleiben
noch x Arbeitstage", Mo–Fr) sowie das Wichtigste auf einen Blick – Kennzahlen und die
Liste **Überfällig / Bald fällig / Eigene To-Dos**, klar getrennt. Die drei
Standard-Tabs (*Alle · Wartungen · Eigene To-Dos*) bleiben bestehen; **`+`** legt einen
eigenen, benannten Tab an. Jeder Tab speichert **seine** Filter- und
Ansichtseinstellungen in `localStorage` (über Sitzungen hinweg). Favoriten (`★`)
werden vorne angepinnt; Rechtsklick oder Hover → `⋯` bietet *Anpinnen · Tab speichern ·
Umbenennen · Tab schließen*. **Tab speichern** legt den Tab in eine Ablage (max. 5),
die über **`+`** wieder geöffnet werden kann – so wächst nichts endlos an. Das
Zeitraum-Feld grenzt nach dem Fristjahr (z. B. 2026) und/oder per **von-/bis-Datum** ein.

### Presets (clientseitig)
Zusätzlich lässt sich die Kombination aus Gruppieren, Sortieren und Ansicht als
**Preset** speichern (`＋`), im Dropdown wählen, mit `★` **als Standard** festlegen
und mit `×` löschen. Ein Standard-Preset gibt die Anzeige vor, mit der **neue Tabs**
starten. Alles liegt in `localStorage` – reine Anzeigepräferenz, keine Stammdaten.

**To-Dos** nutzen exakt dieselben Gruppierungen und Ansichten und sind nur durch
ihr Kennzeichen „To-Do" unterscheidbar. Im Bereich **Alle** erscheinen Wartungen
und To-Dos gemeinsam, bleiben aber als eigene Punkte erkennbar.

### Termin-Disposition (Outlook)
* **Ganztägig ist der Standard** – ein Datum genügt; oben umschaltbar auf
  „Mit Uhrzeit" (Beginn/Ende).
* **Betreff** ist editierbar: bei einer Position die Tätigkeit, beim
  Standortkopf pauschal „Wartungsarbeiten".
* **Ort** ist immer `"{objekt_nr} {objekt_name}"`, **Betreff** die Tätigkeit.
* **Teilnehmer**: voreingestellt `dispo.sendertechnik@swr.de`, Chips einzeln
  entfernbar, neue Adresse eintippen und mit Enter übernehmen.
* Zwei Wege: **„In Outlook Web öffnen"** (vorausgefülltes Formular) und
  **„ICS für Outlook"** (Datei für Desktop-Outlook, RFC-konform mit UID und
  DTSTAMP).

### Eigene To-Dos
Für alles, was vor Ort anfällt und nicht in den Wartungsstammdaten steht –
z. B. „Blitzschutzableiter erneuern": Aufgabe, optionaler Standortbezug, Frist,
Zuständige Person, Anmerkung. Anhänge (Fotos, Protokolle) mit **Kommentar je
Anhang** sind möglich. Gespeichert wird getrennt von den Wartungen
(`/api/todos`, lokal `wartungstool.v1.todos`).

### Design
**Hell ist der Standard** (Carbon g10); auch die Titelleiste ist dann hell. Unter
`⋯ → Einstellungen` umschaltbar auf Dunkel oder Automatisch.

Für die Lesbarkeit sind die Zeilen **abwechselnd schattiert** (weiß/helles Grau,
im Dunkelmodus entsprechend abgestuft), damit das Auge in den langen Listen und
Tabellen die Zeile halten kann.

**Startbereich ist „Alle"** – Wartungen und eigene To-Dos gemeinsam; über die
Bereichsknöpfe lässt sich auf *Wartungen* oder *Eigene To-Dos* einschränken.

**Tastenkürzel:** `/` Suche · `↑ ↓` Zeilen · `Enter` Details · `E` abhaken ·
`N` Kommentar · `M` Ansicht · `P` drucken · `Esc` Filter zurück.

### Zentrale Konfiguration (Administration, ohne Oberfläche)
```
index.html?api=https://server/api     → SQL-Backend statt lokaler Bestand
index.html?local                      → lokalen Bestand erzwingen
index.html?user=Salwa,%20Christian    → Namen vorbelegen
```

---

## 5. API-Vertrag

| Methode | Pfad | Rolle | Zweck |
|---|---|---|---|
| `GET` | `/api/items` | Techniker | Positionen lesen |
| `PATCH` | `/api/items/:id/erledigung` | Techniker | **nur** Erledigungsfelder |
| `GET`/`POST`/`DELETE` | `/api/items/:id/anhaenge[/:aid]` | Techniker | Anhänge |
| `GET` | `/api/items/:id/anhaenge/:aid/datei` | Techniker | Anhang herunterladen |
| `PATCH` | `/api/anhaenge/:aid` | Techniker | Kommentar zum Anhang |
| `GET`/`POST` | `/api/todos` | Techniker | eigene To-Dos (volle Rechte) |
| `PUT`/`DELETE` | `/api/todos/:id` | Techniker | eigene To-Dos ändern/löschen |
| `GET`/`POST`/`DELETE` | `/api/todos/:id/anhaenge[/:aid]` | Techniker | Anhänge am To-Do |
| `GET` | `/api/health` | – | Statusabfrage |
| `POST`/`PUT`/`DELETE` | `/api/admin/items[/:id]` | Administration | Stammdaten pflegen |
| `POST` | `/api/admin/items/import` | Administration | Bestand ersetzen (Array **oder** Export-Objekt) |

Datumsfelder stets `TT.MM.JJJJ`, `erledigt` als Boolean. Anhänge werden als
Base64 übertragen und unter `data/anhaenge/` abgelegt (max. 10 MB).

**Ausfallsicherheit:** Ist das Backend nicht erreichbar, meldet die Kopfzeile
„Offline", die Oberfläche bleibt nutzbar, und eine fehlgeschlagene Erledigung
wird zurückgerollt statt fälschlich als gespeichert angezeigt.

---

## 6. Tests

```
node tests/checks.mjs    # 126 Prüfungen der Frontend-Logik (ohne Browser)
node tests/api.mjs       #  26 Prüfungen gegen die API (Server muss laufen)
```

`checks.mjs` lädt `index.html`, ersetzt das DOM durch einen Stub und führt die
Anwendungslogik in `node:vm` wirklich aus – inklusive daten.js, sodass auch das
verschachtelte Exportformat geprüft wird. Die Suite deckt u. a. ab: Sortierung
„offen zuerst", Standort- und Zeitplan-Ansicht, Abschlussdialog mit
Kommentarvorschlägen, Outlook-Link und ICS-Format, Einstellungen/Design, den
Bereich „Alle", To-Dos in allen Ansichten, Anhänge sowie die Rollentrennung.

Zusätzlich prüft die Suite **Regressionen**, die im Projektverlauf aufgetreten
sind: verdeckte Statusdoppelungen, versetzte Spalten in der Standortzeile,
`hidden`-Attribut gegen eigene `display`-Regeln, ein Temporal-Dead-Zone-Fehler
im To-Do-Dialog (`const objects = objects()`) und fehlende RFC-Pflichtfelder
im Kalender.

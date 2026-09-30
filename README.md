# Wartungstool – Technik Außeneinsatz

Web-Frontend für die Ausführung und Protokollierung jährlicher Wartungspunkte.
Ersetzt das alte Visual-Basic-Tool, **ohne dessen Rechteproblem**: Wartungen
werden im Frontend nicht angelegt oder geändert – das macht die Datenbank-
Administration. Eigene To-Dos des Technikers sind bewusst davon getrennt.

```
wartungstool/
├─ index.html          ← die komplette Anwendung (HTML + CSS + JS, kein Build)
├─ daten.js            ← Stammdaten für den Betrieb ohne Server (aus wartungen2026.json)
├─ wartungen2026.json  ← Export der Wartungsaufgaben (Quelle der Stammdaten)
├─ schema.sql          ← SQL-Schema (Wartungen, To-Dos, Anhänge)
├─ server.mjs          ← Testserver: SQLite + REST-API, ohne npm-Abhängigkeiten
├─ start.cmd           ← Doppelklick: Server starten und Browser öffnen
├─ tests/checks.mjs    ← 108 Prüfungen der Frontend-Logik (node tests/checks.mjs)
├─ tests/api.mjs       ← 26 Prüfungen gegen die API (node tests/api.mjs)
└─ README.md
```

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

**Leitidee:** Die App ist ein Arbeitsmittel, kein Datenbrowser. Der Kopf besteht
unter der dunklen bzw. hellen Titelleiste nur aus **zwei Zeilen**:

1. **Prominente Suche** (Taste `/`, breites Feld) · *Neues To-Do* · Ansicht
   (`Standorte · Zeitplan · Liste`) · Fortschritt
2. **Filter, in einer Zeile gebündelt**: Bereich (`Alle · Wartungen · Eigene
   To-Dos`, jeweils mit Anzahl) · Status-Chips mit Zahlen (`Alle · Offen · Bald
   fällig · Überfällig · Erledigt`) · *Meine* · Personensuche, Tätigkeit,
   Sortierung · *Alle (ein/aus)klappen*

Jede Zahl kommt nur **einmal** vor (in den Chips bzw. Bereichsknöpfen); eine
eigene Kennzahlenzeile gibt es nicht. Die frühere Überschrift entfällt ebenfalls
– der aktive Bereichsknopf zeigt den Kontext. Das erledigt auch die frühere
„doppelte" Optik: Bereich und Status stehen nun sichtbar als zwei Filter
nebeneinander getrennt statt in zwei konkurrierenden Zeilen. Die Suche deckt
Objektname **und** -nummer ab – ein eigenes Objekt-Auswahlfeld ist daher
überflüssig und entfallen.

Ganz unten, dezent in der Mitte, zeigt eine schmale Fußzeile die **Datenquelle**
(`Stammdaten: daten.js`, `SQL-Backend`, `Offline`) statt prominent im Kopf.

| Aktion | Weg |
|---|---|
| Suchen | Suchfeld oder Taste `/` |
| Filtern | Bereichs-Umschalter + Status-Chips + Filterzeile |
| **Abhaken** | Kästchen ganz links – Datum, Name und der **Abschlusskommentar** werden abgefragt |
| **Termin disponieren** | Kalender-Symbol in der Zeile **oder im Standortkopf** (pauschaler Termin) |
| Kommentar ändern | „Kommentar" in der Zeile oder Detailleiste (Wartungen) bzw. im To-Do-Dialog |
| Anhänge | Detailleiste der Wartung bzw. im To-Do-Dialog – mit Kommentar je Anhang |
| Details ansehen | Zeile anklicken oder `Enter` |
| Drucken / CSV / JSON | `P` bzw. Menü `⋯` |
| Einstellungen | Menü `⋯` → *Einstellungen* (Design, Terminadresse, eigener Name) |

### Ansichten (Taste `M`)
| Ansicht | Zweck |
|---|---|
| **Standorte** *(Start)* | je Standort Fortschritt, Warnhinweise, Vorschau der offenen Tätigkeiten, Termin-Knopf; **kritische zuerst**, abgeschlossene unten. Anklicken klappt die Positionen auf. |
| **Zeitplan** | nach Dringlichkeit gruppiert: Überfällig → Bald fällig → Im Zeitraum → Später geplant → Erledigt |
| **Liste** | flache, sortierbare Tabelle für die Gesamtdurchsicht |

**In allen Ansichten stehen offene Positionen oben**; abgeschlossene haben keine
Frist mehr und rutschen ans Ende.

**To-Dos** nutzen exakt dieselben Ansichten und sind nur durch ihr Kennzeichen
„To-Do" und eine dezente Kante unterscheidbar. Im Bereich **Alle** erscheinen
Wartungen und To-Dos gemeinsam, bleiben aber als eigene Punkte erkennbar.

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
node tests/checks.mjs    # 116 Prüfungen der Frontend-Logik (ohne Browser)
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

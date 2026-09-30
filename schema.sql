-- ============================================================================
--  Wartungstool – SQL-Schema (Vorbereitung für das spätere Backend)
--  ----------------------------------------------------------------------------
--  Kompatibel mit SQLite (Standard, siehe server.mjs) und – bis auf die
--  Datumstypen – mit PostgreSQL / MySQL / SQL Server.
--
--  Datumsfelder werden bewusst als TEXT im Format TT.MM.JJJJ geführt, damit
--  Import/Export, Frontend und Altdatenbestand 1:1 zusammenpassen.
-- ============================================================================

CREATE TABLE IF NOT EXISTS wartungspunkte (
  id             INTEGER PRIMARY KEY AUTOINCREMENT, -- bzw. SERIAL / IDENTITY
  objekt_art     TEXT    NOT NULL DEFAULT 'Standorte',
  objekt_nr      TEXT    NOT NULL DEFAULT '',
  objekt_name    TEXT    NOT NULL DEFAULT '',
  beschreibung   TEXT    NOT NULL DEFAULT '',
  taetigkeit     TEXT    NOT NULL DEFAULT '',
  kommentar      TEXT    NOT NULL DEFAULT '',
  intervall      TEXT    NOT NULL DEFAULT '',       -- z. B. "alle 12 Monate (variabel)"
  ab             TEXT    NOT NULL DEFAULT '',       -- TT.MM.JJJJ
  bis            TEXT    NOT NULL DEFAULT '',       -- TT.MM.JJJJ
  zustaendig     TEXT    NOT NULL DEFAULT '',
  erledigt       INTEGER NOT NULL DEFAULT 0,        -- 0/1  (BOOLEAN)
  erledigt_am    TEXT    NOT NULL DEFAULT '',       -- TT.MM.JJJJ oder leer
  erledigt_durch TEXT    NOT NULL DEFAULT '',
  erledigt_notiz TEXT    NOT NULL DEFAULT '',       -- Abschlusskommentar des Technikers
  external_id    TEXT    NOT NULL DEFAULT '',       -- Kennung aus dem Altsystem/Export
  hash_key       TEXT    NOT NULL DEFAULT '',       -- Prüfsumme des Exports (Wiedererkennung)
  geaendert_am   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Anhänge (Messprotokolle, Fotos, Prüfberichte) – sowohl an Wartungspositionen
-- als auch an eigenen To-Dos. bezug_art unterscheidet beides.
CREATE TABLE IF NOT EXISTS wartung_anhaenge (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  bezug_art      TEXT    NOT NULL DEFAULT 'wartung',  -- 'wartung' | 'todo'
  bezug_id       INTEGER NOT NULL DEFAULT 0,
  dateiname      TEXT    NOT NULL DEFAULT '',
  mime           TEXT    NOT NULL DEFAULT 'application/octet-stream',
  groesse        INTEGER NOT NULL DEFAULT 0,
  pfad           TEXT    NOT NULL DEFAULT '',         -- relativer Pfad im Dateisystem
  kommentar      TEXT    NOT NULL DEFAULT '',         -- Bemerkung zum Anhang
  hochgeladen_am TEXT    NOT NULL DEFAULT '',
  hochgeladen_von TEXT   NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_anh_bezug ON wartung_anhaenge (bezug_art, bezug_id);

-- ============================================================================
--  ROLLENTRENNUNG
--  Die Spalten objekt_art … zustaendig sind Stammdaten und werden
--  ausschließlich von der Administration gepflegt. Das Techniker-Frontend
--  schreibt nur über den Endpunkt PATCH /api/items/:id/erledigung und darf
--  dort ausschließlich erledigt, erledigt_am, erledigt_durch und
--  erledigt_notiz setzen. In der Produktion empfiehlt sich dafür ein eigener
--  Datenbankbenutzer mit Spaltenrechten:
--
--    GRANT SELECT                       ON wartungspunkte TO ROLLE_TECHNIK;
--    GRANT UPDATE (erledigt, erledigt_am,
--                  erledigt_durch, erledigt_notiz)
--                                       ON wartungspunkte TO ROLLE_TECHNIK;
-- ============================================================================

-- Schnelle Auswertung "wer hat noch offene Punkte", "was ist überfällig"
CREATE INDEX IF NOT EXISTS ix_wp_zustaendig ON wartungspunkte (zustaendig);
CREATE INDEX IF NOT EXISTS ix_wp_objekt      ON wartungspunkte (objekt_nr, objekt_name);
CREATE INDEX IF NOT EXISTS ix_wp_erledigt    ON wartungspunkte (erledigt);

-- Zusatzaufgaben (To-Dos) des Technikers – bewusst GETRENNT von den
-- Wartungsstammdaten. Diese Datensätze darf das Frontend anlegen und ändern,
-- weil sie vor Ort entstehen (z. B. "Blitzschutzableiter erneuern").
CREATE TABLE IF NOT EXISTS wartung_todos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  taetigkeit     TEXT    NOT NULL DEFAULT '',      -- die Aufgabe selbst
  objekt_nr      TEXT    NOT NULL DEFAULT '',      -- optionaler Standortbezug
  objekt_name    TEXT    NOT NULL DEFAULT '',
  kommentar      TEXT    NOT NULL DEFAULT '',
  bis            TEXT    NOT NULL DEFAULT '',      -- Frist TT.MM.JJJJ
  ab             TEXT    NOT NULL DEFAULT '',
  zustaendig     TEXT    NOT NULL DEFAULT '',
  erledigt       INTEGER NOT NULL DEFAULT 0,
  erledigt_am    TEXT    NOT NULL DEFAULT '',
  erledigt_durch TEXT    NOT NULL DEFAULT '',
  erledigt_notiz TEXT    NOT NULL DEFAULT '',
  erstellt_am    TEXT    NOT NULL DEFAULT '',
  erstellt_von   TEXT    NOT NULL DEFAULT '',
  geaendert_am   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_todo_erledigt ON wartung_todos (erledigt);
CREATE INDEX IF NOT EXISTS ix_todo_bis      ON wartung_todos (bis);

-- Optionales Audit-Log: jede Statusänderung nachvollziehbar
CREATE TABLE IF NOT EXISTS wartung_protokoll (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  wartung_id     INTEGER NOT NULL REFERENCES wartungspunkte (id) ON DELETE CASCADE,
  zeitpunkt      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  benutzer       TEXT    NOT NULL DEFAULT '',
  aktion         TEXT    NOT NULL DEFAULT '',       -- create | update | delete | done
  feld           TEXT    NOT NULL DEFAULT '',
  alt            TEXT    NOT NULL DEFAULT '',
  neu            TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_wp_prot_wp ON wartung_protokoll (wartung_id);

-- Stammdaten (für Auswahllisten im Frontend, optional)
CREATE TABLE IF NOT EXISTS objektarten (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
INSERT OR IGNORE INTO objektarten (name) VALUES ('Standorte');

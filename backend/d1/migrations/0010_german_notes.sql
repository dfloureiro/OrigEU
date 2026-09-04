-- Adds a fifth language for brands.notes, alongside notes_en/notes_pt/
-- notes_es/notes_fr (see backend/d1/migrations/0006_bilingual_notes.sql,
-- 0008_spanish_notes.sql and 0009_french_notes.sql). Starts NULL for every
-- row — a one-off backfill translates the ~2,183 existing notes (see git
-- history), new brands fill it in via the backoffice going forward, same
-- pattern as notes_es/notes_fr did.
ALTER TABLE brands ADD COLUMN notes_de TEXT;

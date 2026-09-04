-- Adds a third language for brands.notes, alongside notes_en/notes_pt
-- (see backend/d1/migrations/0006_bilingual_notes.sql). Starts NULL for
-- every row — a one-off backfill translates the ~2,183 existing English/
-- Portuguese notes (see git history), new brands fill it in via the
-- backoffice going forward, same pattern as notes_pt did.
ALTER TABLE brands ADD COLUMN notes_es TEXT;

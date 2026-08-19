-- Split brands.notes into notes_en/notes_pt so the extension can show a
-- brand's note in the user's own language instead of always English.
-- Rename rather than drop+recreate to keep the 197 existing English notes
-- (see backend/README.md) without a data migration script. notes_pt starts
-- NULL for every row; a one-off backfill translates the existing notes,
-- new brands fill it in via the backoffice going forward. pending_brands
-- keeps its single free-text `notes` column unchanged — that's raw
-- suggestion text in whatever language the submitter used, not something
-- to split until it's promoted into a real brand.
ALTER TABLE brands RENAME COLUMN notes TO notes_en;
ALTER TABLE brands ADD COLUMN notes_pt TEXT;

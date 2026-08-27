-- Adds an optional target to a suggestion: when set, the row isn't
-- proposing a brand-new entry, it's a proposed correction to an existing
-- one — the extension's "suggest a correction" button on a known brand's
-- badge tooltip (content/common.js's suggestEditPayload/data-origeu-suggest-edit),
-- next to its citation link, prefilled with that brand's current data.
-- Reviewing one means applying the suggested fields to that brand via the
-- backoffice's normal edit-brand form (backend/admin/public/admin.js),
-- rather than creating a new row the way an unset brand_id (the original
-- "unknown brand" flow) does — then deleting the pending row either way,
-- same as before. No FK enforcement (D1/SQLite doesn't check REFERENCES
-- unless PRAGMA foreign_keys is on) — a brandId pointing at a since-deleted
-- brand just means the review link 404s, which the backoffice already
-- surfaces as an error rather than something that needs guarding here.
ALTER TABLE pending_brands ADD COLUMN brand_id TEXT REFERENCES brands(id);

CREATE INDEX idx_pending_brands_brand_id ON pending_brands(brand_id);

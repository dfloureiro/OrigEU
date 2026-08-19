-- Suggestions submitted from the extension's "unknown brand" click-to-suggest
-- form (content/common.js). Deliberately separate from `brands`: this table
-- has no `active`/review state of its own because a row's mere existence
-- *is* "pending" — reviewing means promoting the data into a real `brands`
-- row via the backoffice's normal add-brand form, then deleting the row
-- here (backend/admin/src/routes.js DELETE /api/pending/:id).
CREATE TABLE pending_brands (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  countries    TEXT NOT NULL DEFAULT '[]',
  source       TEXT,
  notes        TEXT,
  suggested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_pending_brands_suggested_at ON pending_brands(suggested_at);

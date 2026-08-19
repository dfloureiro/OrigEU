-- brands: the self-curated brand -> country-of-origin database.
--
-- `countries` deliberately stores Portuguese country names, matching
-- escolho.eu's convention, so the extension (lib/eu-countries-pt.js) can
-- classify EU/EFTA membership with zero translation step.
--
-- No EU/EFTA/status column here on purpose: that classification is derived
-- client-side in the extension, kept in one place (lib/eu-countries-pt.js)
-- rather than duplicated server-side where it could drift out of sync.
--
-- `category` is validated in backend/shared/validate.js against the same
-- set the extension scopes matches to (lib/curated-brands.js's
-- RELEVANT_CATEGORIES), not as a DB CHECK — SQLite can't ALTER a CHECK
-- constraint without rebuilding the table, so keep that flexibility in
-- application code instead.
CREATE TABLE brands (
  id          TEXT PRIMARY KEY,               -- slug, e.g. "ritter-sport"; chosen on create, immutable after
  name        TEXT NOT NULL,
  aliases     TEXT NOT NULL DEFAULT '[]',      -- JSON array of strings
  countries   TEXT NOT NULL DEFAULT '[]',      -- JSON array of PT country names
  category    TEXT NOT NULL,
  source      TEXT,                            -- citation URL for the origin claim
  notes       TEXT,
  added_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE INDEX idx_brands_active ON brands(active);
CREATE INDEX idx_brands_name ON brands(name COLLATE NOCASE);

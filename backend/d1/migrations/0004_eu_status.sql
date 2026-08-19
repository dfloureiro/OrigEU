-- EU/EFTA membership as data instead of the hardcoded lists that used to
-- live in the extension (lib/eu-countries-pt.js), so an accession/exit can
-- be edited from the backoffice instead of requiring a new extension
-- release. `aliases` mirrors `brands.aliases` (alternate spellings of the
-- same country, e.g. "República Checa" for "Chéquia") since that's the
-- exact synonym set the old hardcoded lists supported.
--
-- Seeded with the same EU-27 + EFTA-4 set that was hardcoded before, so
-- this migration is a pure refactor with no behavior change on deploy.
CREATE TABLE eu_status (
  country  TEXT PRIMARY KEY,             -- Portuguese country name, matching brands.countries' convention
  aliases  TEXT NOT NULL DEFAULT '[]',   -- JSON array of alternate spellings
  status   TEXT NOT NULL CHECK (status IN ('eu', 'efta'))
);

INSERT INTO eu_status (country, aliases, status) VALUES
  ('Áustria', '[]', 'eu'),
  ('Bélgica', '[]', 'eu'),
  ('Bulgária', '[]', 'eu'),
  ('Croácia', '[]', 'eu'),
  ('Chipre', '[]', 'eu'),
  ('Chéquia', '["República Checa"]', 'eu'),
  ('Dinamarca', '[]', 'eu'),
  ('Estónia', '[]', 'eu'),
  ('Finlândia', '[]', 'eu'),
  ('França', '[]', 'eu'),
  ('Alemanha', '[]', 'eu'),
  ('Grécia', '[]', 'eu'),
  ('Hungria', '[]', 'eu'),
  ('Irlanda', '[]', 'eu'),
  ('Itália', '[]', 'eu'),
  ('Letónia', '[]', 'eu'),
  ('Lituânia', '[]', 'eu'),
  ('Luxemburgo', '[]', 'eu'),
  ('Malta', '[]', 'eu'),
  ('Países Baixos', '["Holanda"]', 'eu'),
  ('Polónia', '[]', 'eu'),
  ('Portugal', '[]', 'eu'),
  ('Roménia', '[]', 'eu'),
  ('Eslováquia', '[]', 'eu'),
  ('Eslovénia', '[]', 'eu'),
  ('Espanha', '[]', 'eu'),
  ('Suécia', '[]', 'eu'),
  ('Islândia', '[]', 'efta'),
  ('Liechtenstein', '["Listenstaine"]', 'efta'),
  ('Noruega', '[]', 'efta'),
  ('Suíça', '[]', 'efta');

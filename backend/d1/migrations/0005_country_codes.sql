-- Countries move from free-text Portuguese names (+ aliases for spelling
-- variants) to ISO 3166-1 alpha-2 codes, in both eu_status and
-- brands.countries. Rationale: a code has exactly one canonical form (no
-- more "Suíça" vs "Suiça" vs alias-juggling), and unlocks two things a
-- name string can't: (1) flag emoji computed algorithmically from the code
-- via Unicode regional indicator symbols, instead of a hardcoded
-- flag-per-country-name map; (2) label translation happens in the
-- extension (content/countries.js) instead of the database, so more
-- languages can be added later without touching stored data.
--
-- eu_status: rebuilt with country_code as the primary key, aliases column
-- dropped (codes don't need spelling variants). Reseeded with the same
-- EU-27 + EFTA-4 set, just keyed by code instead of name.
DROP TABLE eu_status;

CREATE TABLE eu_status (
  country_code TEXT PRIMARY KEY CHECK (length(country_code) = 2),
  status       TEXT NOT NULL CHECK (status IN ('eu', 'efta'))
);

INSERT INTO eu_status (country_code, status) VALUES
  ('AT', 'eu'), ('BE', 'eu'), ('BG', 'eu'), ('HR', 'eu'), ('CY', 'eu'),
  ('CZ', 'eu'), ('DK', 'eu'), ('EE', 'eu'), ('FI', 'eu'), ('FR', 'eu'),
  ('DE', 'eu'), ('GR', 'eu'), ('HU', 'eu'), ('IE', 'eu'), ('IT', 'eu'),
  ('LV', 'eu'), ('LT', 'eu'), ('LU', 'eu'), ('MT', 'eu'), ('NL', 'eu'),
  ('PL', 'eu'), ('PT', 'eu'), ('RO', 'eu'), ('SK', 'eu'), ('SI', 'eu'),
  ('ES', 'eu'), ('SE', 'eu'),
  ('IS', 'efta'), ('LI', 'efta'), ('NO', 'efta'), ('CH', 'efta');

-- brands.countries: rewrite each brand's JSON array in place, replacing
-- every distinct country-name string actually in use (found by querying
-- production before writing this migration) with its ISO code. Safe as a
-- plain text REPLACE since none of these names contain quote/backslash
-- characters that would need JSON-escaping.
UPDATE brands SET countries = REPLACE(countries, '"Alemanha"', '"DE"') WHERE countries LIKE '%"Alemanha"%';
UPDATE brands SET countries = REPLACE(countries, '"Bélgica"', '"BE"') WHERE countries LIKE '%"Bélgica"%';
UPDATE brands SET countries = REPLACE(countries, '"Chéquia"', '"CZ"') WHERE countries LIKE '%"Chéquia"%';
UPDATE brands SET countries = REPLACE(countries, '"Dinamarca"', '"DK"') WHERE countries LIKE '%"Dinamarca"%';
UPDATE brands SET countries = REPLACE(countries, '"Espanha"', '"ES"') WHERE countries LIKE '%"Espanha"%';
UPDATE brands SET countries = REPLACE(countries, '"França"', '"FR"') WHERE countries LIKE '%"França"%';
UPDATE brands SET countries = REPLACE(countries, '"Holanda"', '"NL"') WHERE countries LIKE '%"Holanda"%';
UPDATE brands SET countries = REPLACE(countries, '"Hungria"', '"HU"') WHERE countries LIKE '%"Hungria"%';
UPDATE brands SET countries = REPLACE(countries, '"Irlanda"', '"IE"') WHERE countries LIKE '%"Irlanda"%';
UPDATE brands SET countries = REPLACE(countries, '"Itália"', '"IT"') WHERE countries LIKE '%"Itália"%';
UPDATE brands SET countries = REPLACE(countries, '"México"', '"MX"') WHERE countries LIKE '%"México"%';
UPDATE brands SET countries = REPLACE(countries, '"Noruega"', '"NO"') WHERE countries LIKE '%"Noruega"%';
UPDATE brands SET countries = REPLACE(countries, '"Países Baixos"', '"NL"') WHERE countries LIKE '%"Países Baixos"%';
UPDATE brands SET countries = REPLACE(countries, '"Portugal"', '"PT"') WHERE countries LIKE '%"Portugal"%';
UPDATE brands SET countries = REPLACE(countries, '"Reino Unido"', '"GB"') WHERE countries LIKE '%"Reino Unido"%';
UPDATE brands SET countries = REPLACE(countries, '"Suiça"', '"CH"') WHERE countries LIKE '%"Suiça"%';
UPDATE brands SET countries = REPLACE(countries, '"Suécia"', '"SE"') WHERE countries LIKE '%"Suécia"%';
UPDATE brands SET countries = REPLACE(countries, '"Suíça"', '"CH"') WHERE countries LIKE '%"Suíça"%';
UPDATE brands SET countries = REPLACE(countries, '"Turquia"', '"TR"') WHERE countries LIKE '%"Turquia"%';
UPDATE brands SET countries = REPLACE(countries, '"USA"', '"US"') WHERE countries LIKE '%"USA"%';
UPDATE brands SET countries = REPLACE(countries, '"Ucrânia"', '"UA"') WHERE countries LIKE '%"Ucrânia"%';
UPDATE brands SET countries = REPLACE(countries, '"Áustria"', '"AT"') WHERE countries LIKE '%"Áustria"%';

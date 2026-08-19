-- category turned out unused by the extension (it never factored into
-- matching or badge logic — the only thing that reads brand data is
-- lib/own-brands.js, which never looks at it) and wasn't useful in the
-- backoffice either, so it's being removed rather than carried forward.
ALTER TABLE brands DROP COLUMN category;

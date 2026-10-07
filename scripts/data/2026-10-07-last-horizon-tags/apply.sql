-- ImZaDi: add tags Sci-Fi and Drama to "Last Horizon" (slug last-horizon).
-- Approved by James 2026-10-07 9:56 AM ET. Idempotent: safe to run more than once.
-- Touches ONLY the "_PostTags" join table. No titles, slugs, bodies or dates change,
-- and BlogPost."updatedAt" is NOT bumped (so the Atom feed does not re-announce the post).
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply.sql
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  post_id text;
  n_tags  int;
BEGIN
  SELECT id INTO post_id FROM "BlogPost" WHERE slug = 'last-horizon';
  IF post_id IS NULL THEN
    RAISE EXCEPTION 'abort: post with slug last-horizon not found (was the slug changed?)';
  END IF;
  SELECT count(*) INTO n_tags FROM "Tag" WHERE name IN ('Sci-Fi', 'Drama');
  IF n_tags <> 2 THEN
    RAISE EXCEPTION 'abort: expected existing tags Sci-Fi and Drama, found % of 2', n_tags;
  END IF;
END $$;

-- before
SELECT 'before' AS state, coalesce(string_agg(t.name, ', ' ORDER BY t.name), '(none)') AS last_horizon_tags
FROM "BlogPost" p
LEFT JOIN "_PostTags" pt ON pt."A" = p.id
LEFT JOIN "Tag" t ON t.id = pt."B"
WHERE p.slug = 'last-horizon';

INSERT INTO "_PostTags" ("A", "B")
SELECT p.id, t.id
FROM "BlogPost" p
CROSS JOIN "Tag" t
WHERE p.slug = 'last-horizon' AND t.name IN ('Sci-Fi', 'Drama')
ON CONFLICT DO NOTHING;

-- after
SELECT 'after' AS state, string_agg(t.name, ', ' ORDER BY t.name) AS last_horizon_tags
FROM "BlogPost" p
JOIN "_PostTags" pt ON pt."A" = p.id
JOIN "Tag" t ON t.id = pt."B"
WHERE p.slug = 'last-horizon';

COMMIT;

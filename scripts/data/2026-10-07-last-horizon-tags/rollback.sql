-- ImZaDi: undo apply.sql. Removes ONLY the Sci-Fi and Drama links from "Last Horizon".
-- The post had no tags before 2026-10-07, so this restores its prior state exactly.
-- Idempotent. Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback.sql
\set ON_ERROR_STOP on
BEGIN;

DELETE FROM "_PostTags" pt
USING "BlogPost" p, "Tag" t
WHERE pt."A" = p.id AND pt."B" = t.id
  AND p.slug = 'last-horizon'
  AND t.name IN ('Sci-Fi', 'Drama');

SELECT 'after rollback' AS state, coalesce(string_agg(t.name, ', ' ORDER BY t.name), '(none)') AS last_horizon_tags
FROM "BlogPost" p
LEFT JOIN "_PostTags" pt ON pt."A" = p.id
LEFT JOIN "Tag" t ON t.id = pt."B"
WHERE p.slug = 'last-horizon';

COMMIT;

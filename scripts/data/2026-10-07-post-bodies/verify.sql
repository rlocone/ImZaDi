-- ImZaDi: READ-ONLY check for the 2026-10-07 post-body change. Safe to run any time, before or after.
-- Run:  psql "$DATABASE_URL" -f verify.sql
-- Expect after apply.sql : the 3 rows = NEW, title_ok/slug_ok = t, v1_ok = t.
-- Expect before / after rollback.sql : the 3 rows = OLD.
-- "others_fp" must print the SAME value before and after apply (and after rollback): it hashes every
-- other BlogPost row in full plus every column except "excerpt" of the 3 target rows.

WITH e(slug, title, old_md5, new_md5) AS (VALUES
    ('young-couple', $t$Young Couple$t$, 'cf46e33680ac99cfca49f83244588fdf', 'ecc9383060364e4be799c99fb67f7305'),
    ('intertwinded-addiction', $t$intertwinded addiction$t$, 'cc2340bc4ed77e245349851acc7d037b', '117af891d4f81d5414267b1924058708'),
    ('goodbye', $t$Goodbye$t$, '8bed190a2a7d5ff61663429f24f8aa62', '4e448004dc9b927c03b659f728bff0ea')
)
SELECT e.slug,
       p.title,
       (p.title = e.title) AS title_ok,
       (p.slug IS NOT NULL) AS slug_ok,
       md5(p.excerpt) AS body_md5,
       CASE md5(p.excerpt) WHEN e.new_md5 THEN 'NEW' WHEN e.old_md5 THEN 'OLD' ELSE 'OTHER (stop)' END AS body_state,
       length(p.excerpt) AS chars,
       left(p.excerpt, 40) AS starts_with
FROM e LEFT JOIN "BlogPost" p ON p.slug = e.slug
ORDER BY e.slug;

SELECT slug, title, md5(excerpt) AS body_md5,
       (md5(excerpt) = '1ab532db9a4af78a32a8c137fc3d2e5e' AND title = 'Love of a Lifetime v1') AS v1_ok,
       (SELECT count(*) FROM "Media" m WHERE m."postId" = p.id AND m.type = 'PDF') AS v1_pdfs
FROM "BlogPost" p WHERE slug = 'love-of-a-lifetime-v1';

SELECT md5(string_agg(md5(j::text), ',' ORDER BY id)) AS others_fp, count(*) AS posts
FROM (
  SELECT p.id, CASE WHEN p.slug IN ('young-couple', 'intertwinded-addiction', 'goodbye') THEN to_jsonb(p) - 'excerpt' ELSE to_jsonb(p) END AS j
  FROM "BlogPost" p
) s;

-- ImZaDi: ROLLBACK: restore the exact 2026-10-07 live body ("excerpt" column, rendered on the post page, card blurb and meta
-- description) of exactly 3 posts: young-couple, intertwinded-addiction, goodbye.
-- Approved by James 2026-10-07 9:56 AM ET (Molly's ship package, openings 02-04).
-- The old bodies below were captured from imzadi.love on 2026-10-07 (Next.js flight data of each
-- post page, i.e. the exact string the server rendered) and match the local mirror byte for byte.
-- Touches ONLY "BlogPost"."excerpt" on those 3 rows, matched by slug AND by the md5 of the
-- captured live body. Title, slug, content, dates, tags, media/PDF list: untouched.
-- "updatedAt" is NOT bumped (plain SQL; Prisma's @updatedAt is app-side), so the feed does not
-- re-announce the posts. love-of-a-lifetime-v1 is never matched and is checked unchanged.
-- Restores a row ONLY if it currently holds the new body (so a later manual edit is never clobbered);
-- a row already at the old body is skipped (idempotent). Anything else aborts the whole transaction.
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback.sql
\set ON_ERROR_STOP on
BEGIN;
-- fingerprint of everything the update must NOT change: every other BlogPost row (all columns),
-- plus every column except "excerpt" of the 3 target rows (title, slug, content, dates, flags, ids).
CREATE TEMP VIEW _pb_fp AS
SELECT md5(string_agg(md5(j::text), ',' ORDER BY id)) AS fp
FROM (
  SELECT p.id, CASE WHEN p.slug IN ('young-couple', 'intertwinded-addiction', 'goodbye') THEN to_jsonb(p) - 'excerpt' ELSE to_jsonb(p) END AS j
  FROM "BlogPost" p
) s;
CREATE TEMP TABLE _pb_expect (slug text PRIMARY KEY, old_md5 text, new_md5 text) ON COMMIT DROP;
INSERT INTO _pb_expect VALUES
    ('young-couple', 'cf46e33680ac99cfca49f83244588fdf', 'ecc9383060364e4be799c99fb67f7305'),
    ('intertwinded-addiction', 'cc2340bc4ed77e245349851acc7d037b', '117af891d4f81d5414267b1924058708'),
    ('goodbye', '8bed190a2a7d5ff61663429f24f8aa62', '4e448004dc9b927c03b659f728bff0ea');

CREATE TEMP TABLE _pb_before ON COMMIT DROP AS
SELECT (SELECT fp FROM _pb_fp) AS others_fp,
       (SELECT md5(excerpt) FROM "BlogPost" WHERE slug = 'love-of-a-lifetime-v1') AS v1_md5;

DO $guard$
DECLARE r record;
BEGIN
  FOR r IN SELECT e.slug, e.old_md5, e.new_md5, p.id, md5(p.excerpt) AS cur
           FROM _pb_expect e LEFT JOIN "BlogPost" p ON p.slug = e.slug LOOP
    IF r.id IS NULL THEN RAISE EXCEPTION 'abort: post with slug % not found', r.slug; END IF;
    IF r.cur NOT IN (r.old_md5, r.new_md5) THEN
      RAISE EXCEPTION 'abort: % body md5 % is neither the new body nor the old one; edited after ship? stop and report', r.slug, r.cur;
    END IF;
  END LOOP;
END $guard$;

-- young-couple  ("Young Couple"): restore the 490-char live body (md5 cf46e33680ac99cfca49f83244588fdf)
UPDATE "BlogPost" SET excerpt = $yc_old$💗 A Young Couple I Chapter I The conversation paints a vivid picture of a generational divide on the topic of love and practicality. The mother, hardened by life's experiences, sees the world through a lens of pragmatism. She understands the harsh realities of financial insecurity and the struggles that come with a lack of resources. Her words, "puppy love," and "hard knocks of life," reveal her skepticism about the sustainability of a relationship built solely on youthful infatuation.$yc_old$
WHERE slug = 'young-couple' AND md5(excerpt) = 'ecc9383060364e4be799c99fb67f7305';

-- intertwinded-addiction  ("intertwinded addiction"): restore the 439-char live body (md5 cc2340bc4ed77e245349851acc7d037b)
UPDATE "BlogPost" SET excerpt = $ia_old$🌐 Astound the World Key Takeaways: Sarah experiences rapid cognitive enhancement, including instant language acquisition and advanced cryptography understanding. The couple grapples with the ethical implications and potential dangers of Sarah's newfound abilities. Sarah develops groundbreaking ideas in quantum-resistant cryptography and data security. Their relationship deepens as they navigate the challenges of Sarah's transformation.$ia_old$
WHERE slug = 'intertwinded-addiction' AND md5(excerpt) = '117af891d4f81d5414267b1924058708';

-- goodbye  ("Goodbye"): restore the 476-char live body (md5 8bed190a2a7d5ff61663429f24f8aa62)
UPDATE "BlogPost" SET excerpt = $gb_old$💄 Goodbye 💡 Do I have to write them with lipstick backward on a mirror? ‘eybdoog’ A husband leaving his wife a message in sadness, accompanied by a curated song list and lyrics—adds significant depth to the passage and the concept of writing "goodbye" backward on a mirror. The song list serves as a narrative and emotional framework, revealing the husband’s state of mind, his intentions, and the story of their relationship. Below, I’ll analyze the nuances of this scenario,$gb_old$
WHERE slug = 'goodbye' AND md5(excerpt) = '4e448004dc9b927c03b659f728bff0ea';

DO $check$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _pb_expect e JOIN "BlogPost" p ON p.slug = e.slug AND md5(p.excerpt) = e.old_md5;
  IF n <> 3 THEN RAISE EXCEPTION 'abort: expected 3 rows back on the old body, found %', n; END IF;
  IF (SELECT fp FROM _pb_fp) <> (SELECT others_fp FROM _pb_before) THEN
    RAISE EXCEPTION 'abort: something other than the 3 bodies changed (fingerprint mismatch)';
  END IF;
  IF (SELECT md5(excerpt) FROM "BlogPost" WHERE slug = 'love-of-a-lifetime-v1') <> (SELECT v1_md5 FROM _pb_before) THEN
    RAISE EXCEPTION 'abort: love-of-a-lifetime-v1 body changed';
  END IF;
END $check$;

SELECT 'after rollback' AS state, p.slug, p.title, md5(p.excerpt) AS body_md5,
       CASE md5(p.excerpt) WHEN e.old_md5 THEN 'OLD (live 2026-10-07)' ELSE 'UNEXPECTED' END AS body_state
FROM _pb_expect e JOIN "BlogPost" p ON p.slug = e.slug ORDER BY p.slug;

DROP VIEW _pb_fp;
COMMIT;

-- ImZaDi: replace the body ("excerpt" column, rendered on the post page, card blurb and meta
-- description) of exactly 3 posts: young-couple, intertwinded-addiction, goodbye.
-- Approved by James 2026-10-07 9:56 AM ET (Molly's ship package, openings 02-04).
-- Bodies are the exact UTF-8 bytes of openings/post-bodies/<slug>.txt.
-- Touches ONLY "BlogPost"."excerpt" on those 3 rows, matched by slug AND by the md5 of the
-- captured live body. Title, slug, content, dates, tags, media/PDF list: untouched.
-- "updatedAt" is NOT bumped (plain SQL; Prisma's @updatedAt is app-side), so the feed does not
-- re-announce the posts. love-of-a-lifetime-v1 is never matched and is checked unchanged.
-- Idempotent: a row that already has the new body is skipped. Aborts (whole transaction) if any
-- target row is missing or holds a body that is neither the captured live body nor the new one
-- (prod drift: stop and report; rollback.sql would not be byte-exact for that row).
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply.sql
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
       (SELECT md5(excerpt) FROM "BlogPost" WHERE slug = 'love-of-a-lifetime-v1') AS v1_md5,
       (SELECT count(*) FROM "BlogPost") AS n_posts;

DO $guard$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT e.slug, e.old_md5, e.new_md5, p.id, md5(p.excerpt) AS cur
           FROM _pb_expect e LEFT JOIN "BlogPost" p ON p.slug = e.slug LOOP
    IF r.id IS NULL THEN
      RAISE EXCEPTION 'abort: post with slug % not found (was the slug changed?)', r.slug;
    END IF;
    IF r.cur NOT IN (r.old_md5, r.new_md5) THEN
      RAISE EXCEPTION 'abort: % body md5 % is neither the captured live body (%) nor the new body (%); prod drifted, stop and report',
        r.slug, r.cur, r.old_md5, r.new_md5;
    END IF;
  END LOOP;
  SELECT count(*) INTO n FROM "BlogPost" WHERE slug = 'love-of-a-lifetime-v1';
  IF n <> 1 THEN RAISE EXCEPTION 'abort: expected exactly one love-of-a-lifetime-v1 row, found %', n; END IF;
END $guard$;

-- before
SELECT 'before' AS state, p.slug, p.title, md5(p.excerpt) AS body_md5,
       CASE md5(p.excerpt) WHEN e.old_md5 THEN 'OLD (live 2026-10-07)' WHEN e.new_md5 THEN 'NEW (already applied)' ELSE 'OTHER' END AS body_state
FROM _pb_expect e JOIN "BlogPost" p ON p.slug = e.slug ORDER BY p.slug;

-- young-couple  ("Young Couple"): 490 -> 519 chars
UPDATE "BlogPost" SET excerpt = $yc_new$💗 A Young Couple — Chapter I

His mother called it puppy love.

She said it plainly and looked at the two of them as if she could already see the hard knocks of life coming up the road. No money. No jobs.

"No money, no jobs," her son said. "Just love."

"Children shouldn't be having children if they are children themselves."

"Our whole lives are before us."

"Life can be fickle at times," she said. Softer now.

Then her eyes dropped to the girl's hand. "What is that I see? Is that a ring on your hand, my dear?"
$yc_new$
WHERE slug = 'young-couple' AND md5(excerpt) = 'cf46e33680ac99cfca49f83244588fdf';

-- intertwinded-addiction  ("intertwinded addiction"): 439 -> 448 chars
UPDATE "BlogPost" SET excerpt = $ia_new$🌐 Astound the World

The village was loud with a language neither of them knew. Sarah sat among the islanders and listened, brow furrowed, very still.

Within minutes she answered them. In their own tongue.

The locals stared. Then they laughed, delighted, and leaned in to talk.

Sarah turned to David, eyes wide. "My love, it's incredible. It's all mathematics. Patterns and syntax."

He had watched her change the whole trip. Nothing like this.
$ia_new$
WHERE slug = 'intertwinded-addiction' AND md5(excerpt) = 'cc2340bc4ed77e245349851acc7d037b';

-- goodbye  ("Goodbye"): 476 -> 469 chars
UPDATE "BlogPost" SET excerpt = $gb_new$💄 Goodbye

The mirror was fogged when Lucy stepped out of the shower. She reached to wipe it clear and stopped.

Under the steam, red lines. Letters, smeared in her own crimson lipstick.

eybdoog.

Backward. Written to be read in the glass.

On his desk he had left a list of songs, every lyric written out. Fix You. The Winner Takes It All. Sometimes When We Touch. Always Remember Us This Way.

Goodbye. In the one place she would have to look at herself to read it.
$gb_new$
WHERE slug = 'goodbye' AND md5(excerpt) = '8bed190a2a7d5ff61663429f24f8aa62';

DO $check$
DECLARE n int; b record;
BEGIN
  SELECT count(*) INTO n FROM _pb_expect e JOIN "BlogPost" p ON p.slug = e.slug AND md5(p.excerpt) = e.new_md5;
  IF n <> 3 THEN RAISE EXCEPTION 'abort: expected 3 rows with the new body, found %', n; END IF;
  SELECT * INTO b FROM _pb_before;
  IF (SELECT fp FROM _pb_fp) <> b.others_fp THEN
    RAISE EXCEPTION 'abort: something other than the 3 bodies changed (fingerprint mismatch)';
  END IF;
  IF (SELECT md5(excerpt) FROM "BlogPost" WHERE slug = 'love-of-a-lifetime-v1') <> b.v1_md5 THEN
    RAISE EXCEPTION 'abort: love-of-a-lifetime-v1 body changed';
  END IF;
  IF (SELECT count(*) FROM "BlogPost") <> b.n_posts THEN RAISE EXCEPTION 'abort: post count changed'; END IF;
END $check$;

-- after
SELECT 'after' AS state, p.slug, p.title, md5(p.excerpt) AS body_md5,
       CASE md5(p.excerpt) WHEN e.new_md5 THEN 'NEW' ELSE 'UNEXPECTED' END AS body_state
FROM _pb_expect e JOIN "BlogPost" p ON p.slug = e.slug ORDER BY p.slug;
SELECT 'unchanged' AS check, b.others_fp = (SELECT fp FROM _pb_fp) AS other_rows_and_cols_identical,
       b.v1_md5 AS v1_body_md5_before, (SELECT md5(excerpt) FROM "BlogPost" WHERE slug = 'love-of-a-lifetime-v1') AS v1_body_md5_after
FROM _pb_before b;

DROP VIEW _pb_fp;
COMMIT;

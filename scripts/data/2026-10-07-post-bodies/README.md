# 2026-10-07 — post bodies for 3 stories (data change)

Replaces the body of exactly three posts with Molly's approved openings (ship package
`imzadi-ship-2026-10-07`, openings 02–04). Approved by James on 2026-10-07 (9:56 AM ET).

| slug | live title (unchanged) | body now (live 10/7) | new body |
|---|---|---|---|
| `young-couple` | Young Couple | 490 chars, md5 `cf46e336…` | 519 chars, md5 `ecc93830…` (`openings/post-bodies/young-couple.txt`) |
| `intertwinded-addiction` | intertwinded addiction | 439 chars, md5 `cc2340bc…` | 448 chars, md5 `117af891…` |
| `goodbye` | Goodbye | 476 chars, md5 `8bed190a…` | 469 chars, md5 `4e448004…` |

The "body" is the `BlogPost.excerpt` column: it is what the post page renders (`whitespace-pre-wrap`),
and the home-page card blurb (first 150 chars) and `<meta name="description">` / og / twitter
description (first 200 chars) are cut from it. `BlogPost.content` is not rendered and is not touched.
New bodies are the exact UTF-8 bytes of the package's `.txt` files (paragraphs separated by a blank
line, one trailing newline), embedded with dollar-quoting so apostrophes, quotes and emoji are safe.

**Love of a Lifetime v1 is on hold (James, 10/7 10:15: "Leave v1 alone").** `love-of-a-lifetime-v1`
is never matched; both scripts assert its body md5 is unchanged inside the transaction.

| File | Purpose |
|---|---|
| `apply.sql` | One transaction. Matches each row by slug **and** by the md5 of the captured live body; aborts if a slug is missing or a body is neither the captured live body nor the new one (prod drift). Asserts afterwards: exactly 3 rows hold the new body, every other column of those rows and every other BlogPost row is unchanged (fingerprint), v1 unchanged, post count unchanged. Idempotent. |
| `rollback.sql` | Restores the exact 2026-10-07 live bodies (embedded verbatim, captured from the live pages' Next.js flight data and byte-identical to the local mirror). Only restores a row that currently holds the new body; aborts on anything else. Idempotent. |
| `verify.sql` | Read-only. Per row: title, title_ok, body md5, NEW/OLD state; v1 md5 + `v1_ok` + its PDF count (31); `others_fp` fingerprint (must print the same value before apply, after apply and after rollback). |

```bash
# 0. backup the 3 rows first (plus v1 for the record)
psql "$DATABASE_URL" -c "\copy (SELECT * FROM \"BlogPost\" WHERE slug IN ('young-couple','intertwinded-addiction','goodbye','love-of-a-lifetime-v1')) TO 'blogpost-4rows-before-20261007.csv' CSV HEADER"
psql "$DATABASE_URL" -f verify.sql            # expect OLD x3, v1_ok t; note others_fp
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply.sql
psql "$DATABASE_URL" -f verify.sql            # expect NEW x3, title_ok t, v1_ok t, same others_fp
# rollback if needed
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback.sql
```

`updatedAt` is deliberately not touched (plain SQL; Prisma's `@updatedAt` is app-side), so the Atom
feed does not re-announce the posts. Pages are `force-dynamic`, so the change shows on the next request.
Tested 2026-10-07 on the local review mirror only (apply → verify → apply again → rollback → rollback
again → verify; whole-table md5 identical to before; guard tests for drift and a missing slug).

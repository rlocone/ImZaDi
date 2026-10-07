# 2026-10-07 — Last Horizon tags (data change)

Adds the tags **Sci-Fi** and **Drama** to the post `last-horizon`, which has none today.
Approved by James on 2026-10-07 (9:56 AM ET). Source: Molly's cleanup package, Section 4
(the story's own body hashtags are #SciFi #Drama).

Tags live in Postgres (implicit Prisma m2m table `"_PostTags"`, A = BlogPost.id, B = Tag.id),
so this is a data change, not a code change. Run it once at ship time, after the code deploy.

| File | Purpose |
|---|---|
| `apply.sql` | Idempotent insert of the two links. Aborts if the post or either tag is missing. |
| `rollback.sql` | Removes exactly those two links (restores "no tags"). |
| `verify.sql` | Read-only per-tag counts + Last Horizon's tags. |

```bash
# 1. backup the join table first
pg_dump "$DATABASE_URL" -t '"_PostTags"' --data-only > postTags-before-20261007.sql
# 2. apply, 3. verify
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply.sql
psql "$DATABASE_URL" -f verify.sql     # expect Sci-Fi 7, Drama 11
# rollback if needed
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f rollback.sql
```

`updatedAt` is deliberately not touched, so the feed does not re-announce the post.

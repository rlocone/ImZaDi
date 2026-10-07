# 2026-10-07 — 8 chapter PDFs rebuilt (file swap, same file IDs)

Approved by James on 2026-10-07 (9:56 AM ET): Molly's ship package openings 16–19 and body cleanups
mid-10…mid-13, strip-03, strip-04. The new PDFs keep the **same uuid file names**, so the posts' PDF
links and the `Media` rows do not change. No database change is needed for this step.

| ch | post | uuid | pages old → new |
|---|---|---|---|
| 027 | young-couple | 735ac42e-cda2-4aff-8355-eed8489eb372 | 225 → 217 |
| 028 | young-couple | 364f1972-f3b8-4e2b-a4ba-6fa23c23f074 | 135 → 132 |
| 029 | young-couple | 75443727-09b5-4834-8835-72339a0c3fdc | 127 → 110 |
| 055 | love-of-a-lifetime-v2 | fc49381c-51de-445d-92dc-3a1463f75035 | 69 → 68 |
| 062 | love-of-a-lifetime-v2 | 02c66299-5c6c-4816-8152-89d22f0733db | 63 → 62 |
| 063 | love-of-a-lifetime-v2 | a05da370-afad-45f7-b6e6-a61da198a897 | 35 → 35 |
| 095 | intertwinded-addiction | 4f0bf87d-2ad5-48f4-9aaa-3e9717f750e8 | 56 → 55 |
| 101 | goodbye | 5d47339a-7d1e-44f2-a2ef-72d1d145470a | 9 → 1 |

None of the 31 Love of a Lifetime v1 PDFs is in the batch (their uuids are listed in
`MANIFEST.json` → `excluded_v1_pdf_uuids`, and both scripts refuse them).

**The PDF binaries are not in git** (6.4 MB total). They are in the handoff folder on the box:
`/workspace/imzadi-content-20261007/pdfs/<uuid>.pdf`, next to copies of these scripts. `MANIFEST.json`
holds old/new sha256, sizes and page counts; the scripts check every hash before writing anything.

| File | Purpose |
|---|---|
| `MANIFEST.json` | chapter, uuid, live URL, old/new sha256, old/new bytes and page counts |
| `replace.sh` | Dry-run by default. `--apply` backs up the 8 current files (verified) and swaps in the new ones atomically, keeping owner/mode. `--media` = `STORAGE_PATH/pdfs` (default `/data/imzadi-v2/media/pdfs`). |
| `rollback.sh` | Dry-run by default. `--apply` restores the backups (verified). |
| `build/` | The rebuild tooling (box paths; reference only): style extraction from the old PDF, HTML rebuild from `final-text/`, Chrome print, QA and cross-checks. |

The PDFs are served with `Cache-Control: public, max-age=31536000, immutable` and Cloudflare caches
them, so after the swap the 8 URLs must be **purged in Cloudflare** or visitors keep getting the old files.

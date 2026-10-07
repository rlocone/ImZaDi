#!/usr/bin/env bash
# ImZaDi 2026-10-07: restore the 8 chapter PDFs from the backup replace.sh made. DRY-RUN unless --apply.
# usage: rollback.sh [--apply] [--media DIR] [--backup DIR]   (same defaults as replace.sh)
# Restores a file only if the live copy is the new version (or skips it if it is already the old one) and the
# backup hashes to the old sha256. Any mismatch -> exit before anything is written.
set -euo pipefail
APPLY=0; MEDIA=/data/imzadi-v2/media/pdfs; BACKUP="$HOME/imzadi-pdf-backup-20261007"
while [ $# -gt 0 ]; do case "$1" in
  --apply) APPLY=1;; --media) MEDIA="$2"; shift;; --backup) BACKUP="$2"; shift;;
  *) echo "unknown arg $1"; exit 2;; esac; shift; done
# uuid old_sha256 new_sha256 chapter   (from MANIFEST.json; do not edit by hand)
TABLE="735ac42e-cda2-4aff-8355-eed8489eb372 8552e4fcd2f1e97461911cbaacdbfe2cdd9d6cc598655b9f77873bfb25cb0892 08faf35b35359948ae5d182e34fcd4c16ca43d5494f7fc6a0b0e5936fd1b620d 027
364f1972-f3b8-4e2b-a4ba-6fa23c23f074 5c5afba04069bf5671e0dbafbeaa7a0519c5cca3c828ad7cd56ece7e80c9c07f 9ef1cb2cf060f3c77ef3cc757d22b7dafeb98e77d85d64a6ea3da93f8d96512d 028
75443727-09b5-4834-8835-72339a0c3fdc f1ffaaac116d7bbc104653e53f63d8ba3677a0837860b3654a019026889a7721 6091c88b03061f529098f3f4ac45619d108b3926f7dd40dcb3a5dbfd76c687cc 029
fc49381c-51de-445d-92dc-3a1463f75035 251caab718e5025cf9ac6e8a648ac29fd66af3a63d1cbc063b9df35c220a1ec3 8af1e50b7b687542791c090c3d3ed655137315650d0049abe19ac63ca599d342 055
02c66299-5c6c-4816-8152-89d22f0733db a1afc5ad96d1cb23a296e3013d772f113803d51c88a741d91c1a8a10713c1a77 7e6c1a0e41967bba12ead60803302a0847abbc1746ca2ec358b9563e3bd919db 062
a05da370-afad-45f7-b6e6-a61da198a897 78cb3caf2d61b86b9656dbb137dfb6a3afb4ec0b9bf76133c4efe01eaff788cb bdbda640d482f082c8368c1be6c6c82af8ba8ee9d21e66783ac203d93c767fd9 063
4f0bf87d-2ad5-48f4-9aaa-3e9717f750e8 7af233483ea60df0cd7585001d84b5d3384acc22304d80c4b76b16eb9baf3140 bb685909132e46951697a03e4f99550ce5377ba2331ec8d879af8f206fb90126 095
5d47339a-7d1e-44f2-a2ef-72d1d145470a 6e93bde446648a81a9b934da92e47d10f316da2cc11b9402eb72123fa271d9e9 b75b76bdcdba4365717a78e6c58a92cb20eecb278f7ed59058b818286a2e8b09 101"
V1_UUIDS="033b440b-55ab-4efd-90c0-bf92bac967e4 18277b05-db45-41b5-acd5-47b1d707fcd8 1d4eaead-9e2c-4625-88de-f9e0dafd2c02 28ad5042-ed17-476e-a261-9cddb7d477d2 2bb8ebac-d747-410b-9e32-bd1e89db2f61 30909eb3-f742-4c44-9d06-cdef5e0aa15a 45709556-8c7f-433e-8f64-a7af8328ed5a 4b37011b-e477-4305-8018-0ca5e3faac1c 5a26d40c-0a59-4518-be20-681d9e9feb9b 5cf69d25-7011-45bf-a776-c818f43db81c 5fbc5555-f6f1-4da3-8f4f-6e7e64c17bcf 623fc80a-e9e9-4d0f-9151-b0ba767cf7f7 62ddd900-ec14-4b0d-b3d2-4bfd3d20e0bb 62f541e1-400c-4dbc-a335-b592093f87bf 74d18365-5cc8-4cb5-b3d3-5d7df9ec8b16 85d72fa7-d380-42d1-a2bc-252b054c0ddd 94abb0a8-48c5-4aad-b6b1-1b5a2ba8e538 9a2b0119-0418-4282-8f86-c9bdcf7c8875 a2b0d651-f3ce-422b-85ef-a680a483bbec a5aac418-1b18-4837-8d20-d1bf40740bbc a91cdcd0-f140-4ebb-8a34-dc5667703793 ab8477fd-a97c-4f82-9d2e-74ee25e45253 abd49e26-ce67-4757-8de6-e00e7e0eb8b8 bbb6cb8c-ffc3-4ae2-990f-34cb3af264c4 bcab1f65-5f1f-469d-8921-c352ff8876a7 c7386724-bdaa-4964-b718-e7c3c8ac29ed cdc195b4-1718-40de-9a35-2937c67b3ae4 e56c55e5-62cd-4dae-a6dc-a8de089750a7 ec346bcc-1f1b-4b57-9799-a2eb8d1f6ea6 f4119f1b-5553-4757-a23f-c66cf4fa870a fc9480f2-d62f-42f6-8dd8-3d0f1ebc8ff8"

sha() { sha256sum "$1" | cut -d' ' -f1; }
echo "mode: $([ $APPLY = 1 ] && echo APPLY || echo DRY-RUN)   media=$MEDIA   backup=$BACKUP"
todo=""; fail=0
while read -r U OLD NEW CH; do
  case " $V1_UUIDS " in *" $U "*) echo "ABORT: $U is a Love of a Lifetime v1 PDF"; exit 1;; esac
  live="$MEDIA/$U.pdf"; bak="$BACKUP/$U.pdf"
  [ -f "$live" ] || { echo "FAIL $CH $U: live file missing"; fail=1; continue; }
  cur="$(sha "$live")"
  if [ "$cur" = "$OLD" ]; then echo "skip $CH $U: already the old file"; continue; fi
  [ "$cur" = "$NEW" ] || { echo "FAIL $CH $U: live file is neither new nor old (sha $cur); stop and report"; fail=1; continue; }
  [ -f "$bak" ] && [ "$(sha "$bak")" = "$OLD" ] || { echo "FAIL $CH $U: backup missing or wrong hash at $bak"; fail=1; continue; }
  echo "plan $CH $U: restore from $bak"; todo="$todo $U:$OLD:$CH"
done <<< "$TABLE"
[ $fail = 0 ] || { echo "ABORT: preflight failed, nothing was changed"; exit 1; }
[ -n "$todo" ] || { echo "nothing to do"; exit 0; }
[ $APPLY = 1 ] || { echo "DRY-RUN only. Re-run with --apply to restore."; exit 0; }
for t in $todo; do IFS=: read -r U OLD CH <<< "$t"; live="$MEDIA/$U.pdf"; tmp="$MEDIA/.$U.pdf.rb.$$"
  cp -p "$BACKUP/$U.pdf" "$tmp"; chown --reference="$live" "$tmp" 2>/dev/null || true; chmod --reference="$live" "$tmp"
  mv -f "$tmp" "$live"
  [ "$(sha "$live")" = "$OLD" ] && echo "restored $CH $U" || { echo "ERROR: $U did not verify after restore"; exit 1; }
done
echo "done. Purge the Cloudflare cache for the 8 live URLs again, then verify."

# Golf auto-sync setup

The opt-in "Keep my scores synced automatically" feature stores a golfer's GHIN
login **encrypted** and runs a daily Vercel Cron that logs in and republishes
their public feed. It stays fully disabled until you set two environment
variables in the Vercel project (Settings → Environment Variables):

| Variable         | What it is                                        | How to generate                 |
| ---------------- | ------------------------------------------------- | ------------------------------- |
| `GOLF_VAULT_KEY` | Secret that encrypts stored GHIN logins (AES-256) | `openssl rand -base64 32`       |
| `CRON_SECRET`    | Guards `/api/golf-cron` from outside callers      | `openssl rand -base64 32`       |

Notes:
- Set both for **Production** (and Preview if you want to test there), then redeploy.
- **Never change `GOLF_VAULT_KEY` after golfers enroll** — existing encrypted
  logins become undecryptable and those golfers must re-enroll (sign in again
  with the sync box checked).
- Without `GOLF_VAULT_KEY`, the sync checkbox still appears but the server
  reports that auto-sync isn't configured, and nothing is stored.
- The cron is scheduled daily at 09:00 UTC in `vercel.json`. Vercel's Hobby
  plan runs crons once per day, which matches.
- Manual test after deploy: `curl -H "Authorization: Bearer $CRON_SECRET" https://swikle.com/api/golf-cron`

## Security posture (be honest with yourself)

- Passwords/emails are encrypted at rest with AES-256-GCM; the key lives only in
  a Vercel env var, never in the repo or blob store.
- Vault blobs use an unguessable URL and can only be listed with the server-side
  blob token, so they aren't publicly enumerable.
- This is still a personal-scale credential vault. Only enroll accounts whose
  owners have consented, and don't let it silently grow to many strangers.
- Removing yourself (`/api/golf-vault` DELETE, or "Turn off auto-sync" / "Remove
  from public feed" in the app) deletes the stored login immediately.

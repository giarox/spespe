# Access Matrix – Spespe

| Service | Purpose | VAR NAMES (no values) | Where Stored | How Codex Uses It | Verify Command |
| --- | --- | --- | --- | --- | --- |
| Supabase REST | Public data access + RPC | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `.env.local`, Vercel project env | Configure Supabase client on web & tooling scripts | `pnpm access:check` |
| Supabase Postgres (SQL) | Direct SQL + migrations | `DATABASE_URL` (optional) | `.env.local` (unset) | Run migrations / ad-hoc SQL via CLI | `pnpm access:check` |
| Supabase Service Role | Privileged backend jobs | `SUPABASE_SERVICE_ROLE` | GitHub Actions secret (not stored locally) | Scraper + migrations (server-side) | `pnpm env:print` |
| GitHub API | Repo automation | `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` | `.env.local` / GitHub Actions | Trigger PRs, labels, status checks | `pnpm access:check` |
| Vercel | Deployments + domains | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `.env.local`, Vercel dashboard | Manage deployments, inspect builds | `pnpm access:check` |
| Lidl Playwright State | Auth for Lidl scraping | `LIDL_STORAGE_STATE`, `LIDL_DEVICE_SCALE_FACTOR`, `USER_AGENT` | `.env.local`, secrets/ storage file | Feed crawler session + hi-res tuning | `pnpm access:check` |
| Brevo SMTP | Transactional email | `BREVO_SMTP_HOST`, `BREVO_SMTP_USER`, `BREVO_SMTP_PASS` | `.env.local`, Brevo dashboard | Send magic link or digest emails | `pnpm access:check` |
| LocationIQ | Geocoding | `LOCATIONIQ_API_KEY` | `.env.local`, GitHub Actions | Geocode store + user addresses | `pnpm access:check` |
| Web Push | Browser notifications | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `.env.local`, GitHub Actions | Sign push payloads, register clients | `pnpm access:check` |
| Sentry | Error monitoring | `SENTRY_DSN` | `.env.local`, Vercel | Capture frontend/scraper errors | `pnpm env:print` |
| GitHub Actions Secrets | CI deployments + scraper | Various `secrets.*` referenced in workflows | GitHub Actions | Keeps hourly scraper + deploy jobs running | Inspect workflow YAML |
| Local Secrets Folder | Binary keys / certs | `secrets/**` | Local filesystem only | Stores VAPID or SSL exports when generated | Manual |

## Next Steps for Missing Vars
- Missing `SUPABASE_URL` → `printf '%s' "<https://your.supabase.url>" | pnpm env:set SUPABASE_URL --from-stdin`
- Missing `SUPABASE_ANON_KEY` → `printf '%s' "<anon-key>" | pnpm env:set SUPABASE_ANON_KEY --from-stdin`
- Missing `DATABASE_URL` (optional) → `printf '%s' "<postgres-connection-string>" | pnpm env:set DATABASE_URL --from-stdin`
- Missing GitHub trio → `pnpm env:set GITHUB_OWNER giaroxs` / `pnpm env:set GITHUB_REPO spespe` / `printf '%s' "<token>" | pnpm env:set GITHUB_TOKEN --from-stdin`
- Missing Vercel vars → `printf '%s' "<token>" | pnpm env:set VERCEL_TOKEN --from-stdin` etc.
- Missing Lidl storage state path → `pnpm env:set LIDL_STORAGE_STATE scraper/lidl-storage.json`
- Missing Brevo credentials → `printf '%s' "<host>" | pnpm env:set BREVO_SMTP_HOST --from-stdin` etc.
- Missing LocationIQ key → `printf '%s' "<key>" | pnpm env:set LOCATIONIQ_API_KEY --from-stdin`
- Missing VAPID keys → `printf '%s' "<public>" | pnpm env:set VAPID_PUBLIC_KEY --from-stdin` and likewise for private
- Missing `SENTRY_DSN` if used → `printf '%s' "<dsn>" | pnpm env:set SENTRY_DSN --from-stdin`

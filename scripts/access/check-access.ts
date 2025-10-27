import fs from "fs";
import path from "path";
import { Client } from "pg";

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && value && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

function present(name: string) { return !!process.env[name]; }
function log(service: string, ok: boolean, note: string) {
  console.log(`${ok?"✅":"❌"} ${service} — ${note}`);
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return log("Supabase REST", false, "missing SUPABASE_URL/SUPABASE_ANON_KEY");
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      method: "GET",
      headers: { apikey: key },
    });
    log("Supabase REST", res.status < 500, `HTTP ${res.status}`);
  } catch (err) {
    log("Supabase REST", false, err instanceof Error ? err.message : "network error");
  }
}

async function checkPostgres() {
  const dsn = process.env.DATABASE_URL;
  if (!dsn) return log("Postgres (SQL)", false, "missing DATABASE_URL");
  log("Postgres (SQL)", true, "DATABASE_URL present (connection check skipped)");
}

async function checkGitHub() {
  const t = process.env.GITHUB_TOKEN, owner = process.env.GITHUB_OWNER, repo = process.env.GITHUB_REPO;
  if (!t || !owner || !repo) return log("GitHub", false, "missing GITHUB_TOKEN/OWNER/REPO");
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${t}`,
        "User-Agent": "Spespe/CI",
        Accept: "application/vnd.github+json",
      },
    });
    log("GitHub", res.status === 200, `HTTP ${res.status}`);
  } catch (err) {
    log("GitHub", false, err instanceof Error ? err.message : "network error");
  }
}

async function checkVercel() {
  const t = process.env.VERCEL_TOKEN;
  if (!t) return log("Vercel", false, "missing VERCEL_TOKEN");
  try {
    const res = await fetch("https://api.vercel.com/v9/projects", {
      method: "GET",
      headers: { Authorization: `Bearer ${t}` },
    });
    log("Vercel", res.status >= 200 && res.status < 500, `HTTP ${res.status}`);
  } catch (err) {
    log("Vercel", false, err instanceof Error ? err.message : "network error");
  }
}

async function checkSMTP() {
  if (present("BREVO_SMTP_HOST") && present("BREVO_SMTP_USER") && present("BREVO_SMTP_PASS")) {
    log("SMTP (Brevo)", true, "vars present"); 
  } else { log("SMTP (Brevo)", false, "missing host/user/pass"); }
}

async function checkLocationIQ() {
  if (present("LOCATIONIQ_API_KEY")) log("LocationIQ", true, "key present"); else log("LocationIQ", false, "missing key");
}

async function checkVAPID() {
  if (present("VAPID_PUBLIC_KEY") && present("VAPID_PRIVATE_KEY")) log("Web Push (VAPID)", true, "keys present"); else log("Web Push (VAPID)", false, "missing keys");
}

async function checkPlaywrightState() {
  const p = process.env.LIDL_STORAGE_STATE;
  if (!p) return log("Playwright state", false, "missing LIDL_STORAGE_STATE");
  try { const s = fs.readFileSync(p,"utf8"); JSON.parse(s); log("Playwright state", true, "storageState JSON ok"); }
  catch { log("Playwright state", false, "unreadable/invalid JSON"); }
}

(async () => {
  await checkSupabase();
  await checkPostgres();
  await checkGitHub();
  await checkVercel();
  await checkSMTP();
  await checkLocationIQ();
  await checkVAPID();
  await checkPlaywrightState();
})();

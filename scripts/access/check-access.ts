import fs from "fs";
import https from "https";
import { Client } from "pg";

function present(name: string) { return !!process.env[name]; }
function log(service: string, ok: boolean, note: string) {
  console.log(`${ok?"✅":"❌"} ${service} — ${note}`);
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return log("Supabase REST", false, "missing SUPABASE_URL/SUPABASE_ANON_KEY");
  await new Promise<void>((resolve) => {
    const req = https.request(`${url.replace(/\/$/,"")}/rest/v1/`, { method: "GET", headers: { apikey: key } }, res => {
      log("Supabase REST", res.statusCode! < 500, `HTTP ${res.statusCode}`);
      resolve();
    }); req.on("error", () => { log("Supabase REST", false, "network error"); resolve(); }); req.end();
  });
}

async function checkPostgres() {
  const dsn = process.env.DATABASE_URL;
  if (!dsn) return log("Postgres (SQL)", false, "missing DATABASE_URL");
  try {
    const client = new Client({ connectionString: dsn, ssl: dsn.includes("supabase.co") ? { rejectUnauthorized:false } : undefined });
    await client.connect(); const r = await client.query("SELECT 1"); await client.end();
    log("Postgres (SQL)", (r.rowCount ?? 0) >= 0, "SELECT 1 ok");
  } catch {
    log("Postgres (SQL)", false, "connect/query failed");
  }
}

async function checkGitHub() {
  const t = process.env.GITHUB_TOKEN, owner = process.env.GITHUB_OWNER, repo = process.env.GITHUB_REPO;
  if (!t || !owner || !repo) return log("GitHub", false, "missing GITHUB_TOKEN/OWNER/REPO");
  await new Promise<void>((resolve) => {
    const opts = { method: "GET", headers: { Authorization: `Bearer ${t}`, "User-Agent": "Spespe/CI" } };
    const req = https.request(`https://api.github.com/repos/${owner}/${repo}`, opts, res => {
      log("GitHub", res.statusCode===200, `HTTP ${res.statusCode}`);
      resolve();
    }); req.on("error", () => { log("GitHub", false, "network error"); resolve(); }); req.end();
  });
}

async function checkVercel() {
  const t = process.env.VERCEL_TOKEN;
  if (!t) return log("Vercel", false, "missing VERCEL_TOKEN");
  await new Promise<void>((resolve) => {
    const req = https.request(`https://api.vercel.com/v9/projects`, { method: "GET", headers: { Authorization: `Bearer ${t}` } }, res => {
      log("Vercel", res.statusCode!>=200 && res.statusCode!<500, `HTTP ${res.statusCode}`);
      resolve();
    }); req.on("error", () => { log("Vercel", false, "network error"); resolve(); }); req.end();
  });
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

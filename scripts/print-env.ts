import fs from "fs";
import path from "path";
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  // "SUPABASE_SERVICE_ROLE",
  // "DATABASE_URL",
  "GITHUB_TOKEN","GITHUB_OWNER","GITHUB_REPO",
  "VERCEL_TOKEN","VERCEL_ORG_ID","VERCEL_PROJECT_ID",
  "LIDL_STORAGE_STATE","LIDL_DEVICE_SCALE_FACTOR","USER_AGENT",
  "BREVO_SMTP_HOST","BREVO_SMTP_USER","BREVO_SMTP_PASS",
  "LOCATIONIQ_API_KEY","VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY",
  "SENTRY_DSN","NODE_ENV"
];
const localPath = path.resolve(process.cwd(), ".env.local");
const map: Record<string,string> = {};
const joinEnv = (s: string) => { for (const line of s.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (m) map[m[1]] = m[2]; } };
if (fs.existsSync(localPath)) joinEnv(fs.readFileSync(localPath,"utf8"));
for (const k of Object.keys(process.env)) if (!(k in map) && process.env[k]) map[k] = String(process.env[k]);
const mask = (v?: string) => v ? `${"*".repeat(Math.max(4, v.length - 4))}${v.slice(-4)}` : "";
for (const k of REQUIRED) {
  const present = k in map && !!map[k];
  console.log(`${present?"✅":"❌"} ${k}${present?` = ${mask(map[k])}`:""}`);
}

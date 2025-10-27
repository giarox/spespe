import fs from "fs";
import path from "path";
import { globSync } from "glob";

type Finding = { service: string; vars: Set<string>; location: string; notes?: string; };
const findings: Record<string, Finding> = {};
const add = (service: string, vars: string[], location: string, notes?: string) => {
  if (!findings[service]) findings[service] = { service, vars: new Set(), location, notes };
  vars.forEach(v => findings[service].vars.add(v));
};

function scanEnvFile(p: string) {
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  const names = Array.from(txt.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)).map(m => m[1]);
  if (names.length) add(`env@${path.basename(p)}`, names, p);
}

function scanFiles(globPat: string, re: RegExp, label: string) {
  for (const f of globSync(globPat, { nodir: true })) {
    const txt = fs.readFileSync(f, "utf8");
    const names = Array.from(txt.matchAll(re)).map(m => m[1]).filter(Boolean);
    if (names.length) add(label, names, f);
  }
}

(function main() {
  [".env.local",".env",".env.development",".env.production","app/.env.local","scraper/.env.local"].forEach(scanEnvFile);

  const pe = Object.keys(process.env);
  if (pe.length) add("process.env", pe, "runtime");

  scanFiles("**/*.{ts,tsx,js,jsx}", /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g, "code");
  scanFiles(".github/workflows/**/*.yml", /secrets\.([A-Za-z_][A-Za-z0-9_]*)/g, "github-actions");
  ["vercel.json","netlify.toml","fly.toml","railway.json","docker-compose.yml","docker-compose.yaml"].forEach(p=>{
    if (fs.existsSync(p)) scanFiles(p, /([A-Za-z_][A-Za-z0-9_]*)\s*[:=]/g, path.basename(p));
  });

  const home = process.env.HOME || "";
  const cliHints: Array<[string,string[]]> = [
    [path.join(home, ".config/gh/hosts.yml"), ["GITHUB_TOKEN"]],
    [path.join(home, ".vercel/auth.json"), ["VERCEL_TOKEN"]],
    [path.join(home, ".aws/credentials"), ["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"]],
    [path.join(home, ".netlify/config.json"), ["NETLIFY_AUTH_TOKEN"]],
  ];
  cliHints.forEach(([p,vars]) => { if (p && fs.existsSync(p)) add(`cli@${path.basename(p)}`, vars, p, "present"); });

  Object.values(findings).forEach(f => {
    console.log(`${f.service}\t${Array.from(f.vars).sort().join(",")}\t${f.location}${f.notes?`\t${f.notes}`:""}`);
  });
})();

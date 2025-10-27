import fs from "fs";
import path from "path";

const file = path.resolve(process.cwd(), ".env.local");
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: pnpm env:set KEY VALUE | echo VALUE | pnpm env:set KEY --from-stdin");
  process.exit(1);
}
const key = args[0];
const fromStdin = args.includes("--from-stdin");
const directValue = args[1] && args[1] !== "--from-stdin" ? args[1] : null;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8").trim();
}
function mask(v: string) {
  if (!v) return "";
  const tail = v.slice(-4);
  return `${"*".repeat(Math.max(4, v.length - 4))}${tail}`;
}
(async () => {
  const value = fromStdin ? await readStdin() : (directValue ?? "");
  if (!value) {
    console.error("Missing VALUE. Provide VALUE or use --from-stdin.");
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "", { mode: 0o600 });
  } else {
    try { fs.chmodSync(file, 0o600); } catch {}
  }
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/);
  let found = false;
  const out = lines.map((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m && m[1] === key) { found = true; return `${key}=${value}`; }
    return line;
  });
  if (!found) out.push(`${key}=${value}`);
  fs.writeFileSync(file, out.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
  console.log(`Set ${key}=${mask(value)} to .env.local (0600)`);
})().catch((e) => { console.error(e); process.exit(1); });

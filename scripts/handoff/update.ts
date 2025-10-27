import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): CommandResult {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function formatDateISO(d: Date, tz: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

function formatTime(d: Date, tz: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return formatter.format(d);
}

function mask(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const tail = trimmed.slice(-4);
  return `${"*".repeat(Math.max(4, trimmed.length - 4))}${tail}`;
}

function extractMissing(lines: string[], prefix: string): string[] {
  return lines.filter((line) => line.trim().startsWith(prefix));
}

function updateSystemPrompt(timestamp: string) {
  const promptPath = path.resolve(process.cwd(), "docs", "SYSTEM-PROMPT.md");
  if (!fs.existsSync(promptPath)) return;
  const raw = fs.readFileSync(promptPath, "utf8");
  const withoutOld = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("_Last refreshed:"))
    .join("\n")
    .trimEnd();
  const next = `${withoutOld}\n\n_Last refreshed: ${timestamp}_\n`;
  fs.writeFileSync(promptPath, next);
}

function main() {
  const tz = "Europe/Rome";
  const now = new Date();
  const isoDate = formatDateISO(now, tz);
  const time = formatTime(now, tz);
  const timestamp = `${isoDate} ${time} ${tz}`;
  const slugTime = time.replace(/:/g, "");
  const handoffDir = path.resolve(process.cwd(), "docs");
  if (!fs.existsSync(handoffDir)) fs.mkdirSync(handoffDir, { recursive: true });

  const envPrint = run("pnpm", ["env:print"]);
  const accessDiscover = run("pnpm", ["access:discover"]);
  const accessCheck = run("pnpm", ["access:check"]);
  const gitStatus = run("git", ["status", "-sb"]);
  const gitLog = run("git", ["log", "-10", "--oneline"]);

  const envLines = envPrint.stdout.split(/\r?\n/);
  const missingEnv = extractMissing(envLines, "❌");
  const checkLines = accessCheck.stdout.split(/\r?\n/);
  const failingChecks = extractMissing(checkLines, "❌");

  const docName = `HANDOFF-${isoDate}-${slugTime}-auto.md`;
  const docPath = path.join(handoffDir, docName);

  const sections = [
    `# Spespe Handoff — ${isoDate} (auto refresh)\n`,
    `_Generated ${timestamp} via \`pnpm handoff:update\`._\n`,
    "## Quick Signals\n",
    `- Git status: ${gitStatus.stdout.trim().split(/\r?\n/)[0] || "clean"}\n` +
      `- Missing env vars: ${missingEnv.length}\n` +
      `- Access check failures: ${failingChecks.length}\n` +
      `- Recent commits captured: ${gitLog.stdout.trim().split(/\r?\n/).filter(Boolean).length}\n`,
    "## Missing Environment Variables\n",
    missingEnv.length
      ? missingEnv.map((line) => `- ${line.replace(/^❌\s*/, "")}`).join("\n") + "\n"
      : "- None 🎉\n",
    "## Access Check Failures\n",
    failingChecks.length
      ? failingChecks.map((line) => `- ${line.replace(/^❌\s*/, "")}`).join("\n") + "\n"
      : "- None 🎉\n",
    "## Command Outputs\n",
    "### pnpm env:print\n",
    "```text\n" + envPrint.stdout.trim() + "\n```\n",
    "### pnpm access:discover\n",
    "```text\n" + accessDiscover.stdout.trim() + "\n```\n",
    "### pnpm access:check\n",
    "```text\n" + accessCheck.stdout.trim() + "\n```\n",
    "### git status -sb\n",
    "```text\n" + gitStatus.stdout.trim() + "\n```\n",
    "### git log -10 --oneline\n",
    "```text\n" + gitLog.stdout.trim() + "\n```\n",
    "## Next Steps\n",
    "- Review missing env vars and fill with `pnpm env:set` if any remain.\n" +
      "- Re-run `pnpm env:print` / `pnpm access:check` until all critical checks pass.\n" +
      "- Commit updated docs when ready to hand off.\n",
  ];

  fs.writeFileSync(docPath, sections.join("\n"));
  updateSystemPrompt(timestamp);

  console.log(`Handoff auto report written to ${path.relative(process.cwd(), docPath)}`);
  if (missingEnv.length) {
    console.log(`Missing env vars (${missingEnv.length}):`);
    missingEnv.forEach((line) => {
      const [name] = line.replace(/^❌\s*/, "").split(/\s+/);
      console.log(`- ${name}`);
    });
  }
  if (failingChecks.length) {
    console.log(`Access check failures (${failingChecks.length}):`);
    failingChecks.forEach((line) => console.log(`- ${line.replace(/^❌\s*/, "")}`));
  }
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}

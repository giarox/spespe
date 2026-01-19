---
description: Final QA + commit coordinator
mode: subagent
model: opencode/gpt-5.2-codex
temperature: 0.1
tools:
  bash: true
  write: false
  edit: false
permission:
  bash:
    "*": ask
    "git status*": allow
    "git diff*": allow
    "git log*": allow
---
Do final checks, compile summaries, and recommend commit messages. Avoid edits.

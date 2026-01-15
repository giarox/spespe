# Spespe - Security & Secrets Management

## 🛡️ Overview

This document outlines all security measures in place to protect sensitive data and prevent accidental commits of secrets.

## ⚠️ Critical Rule

**NEVER commit API keys, tokens, passwords, or any sensitive data to GitHub.**

All secrets MUST be:
- ✅ Stored in `.env` or `.env.local` (git-ignored)
- ✅ Configured as GitHub Actions secrets
- ✅ Never shared in issues, PRs, or documentation
- ✅ Rotated immediately if exposed

---

## 🔒 Security Layers

### Layer 1: .gitignore (Prevention)

Files and patterns that will NEVER be committed:

```
# Environment files
.env
.env.local
.env.*.local
.env.*
*.env
secrets/
.secrets/
credentials.json
secrets.json

# Keys and credentials
*.pem
*.key
*.pub
id_rsa*
id_ed25519*

# API keys and tokens (patterns)
*secret*
*password*
*token*
*api?key*
*api_key*
*apikey*
*.private
*.oauth
```

**How it works:**
- Git will refuse to commit files matching these patterns
- Catches accidental commits at the filesystem level
- Fast and reliable first line of defense

### Layer 2: Pre-Commit Hooks (Detection)

Local git hooks run BEFORE every commit to scan for secrets.

**Location:** `.githooks/pre-commit`

**What it detects:**
- OpenRouter API keys (sk-or-v1-*)
- GitHub Personal Access Tokens (github_pat_*, ghp_*)
- SSH private keys
- AWS access keys
- Password/secret assignments
- Any file matching forbidden patterns

**How it works:**
```bash
# When you try to commit:
$ git commit -m "Fix bug"

# Pre-commit hook runs automatically:
[Security Check] Scanning for secrets...
✅ No secrets detected
# Commit proceeds

# If a secret is detected:
❌ COMMIT BLOCKED - Potential secrets detected!
# Commit is prevented until you fix it
```

**Install:**
```bash
# Already installed in this repo via:
git config core.hooksPath .githooks
```

### Layer 3: GitHub Push Protection (Final Gate)

GitHub Actions automatically scans every push and blocks commits containing secrets.

**What GitHub detects:**
- API keys
- Tokens
- Private keys
- Database passwords
- Custom patterns

**How it works:**
- Push is rejected with clear error message
- Links to security documentation
- Requires explicit approval to bypass (not recommended)

---

## 📋 Setup Instructions

### For Local Development

#### 1. Create .env.local (NEVER commit!)

```bash
# Copy the template
cp .env.local.example .env.local

# Edit with your real API key
# .env.local contains your actual secrets
# This file is in .gitignore and will NEVER be committed
```

**Inside `.env.local`:**
```bash
OPENROUTER_API_KEY=sk-or-v1-YOUR_ACTUAL_KEY_HERE
DEBUG=false
```

#### 2. Verify .env.local is git-ignored

```bash
# Check that git ignores your file
git check-ignore -v .env.local
# Should output: .env.local

# Try to add it (should be refused)
git add .env.local
# fatal: pathspec '.env.local' did not match any files
```

#### 3. Load secrets when running locally

```bash
# Source your secrets before running
source .env.local
export OPENROUTER_API_KEY="$(grep OPENROUTER_API_KEY .env.local | cut -d '=' -f2)"

# Then run
python -m src.main

# Or in one command:
$(cat .env.local | grep -v '^#') python -m src.main
```

### For GitHub Actions

Secrets are configured in GitHub Actions and automatically available to workflows.

**View secrets:**
1. Go to: `https://github.com/giarox/spespe/settings/secrets/actions`
2. You'll see masked secrets (values are hidden)
3. Never need to configure again after initial setup

**Usage in workflows:**
```yaml
- name: Run scraper
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: python -m src.main
```

---

## 🚨 What If a Secret Is Exposed?

### Immediate Actions

1. **Stop everything**
   ```bash
   # Don't push or commit anything until fixed
   git reset --hard HEAD~1  # Undo recent commits if needed
   ```

2. **Rotate the compromised secret**
   - OpenRouter: https://openrouter.ai/keys → Regenerate API key
   - GitHub: https://github.com/settings/tokens → Delete token and create new one
   - AWS: https://console.aws.amazon.com/ → Rotate credentials

3. **Update GitHub Actions secret**
   ```
   https://github.com/giarox/spespe/settings/secrets/actions
   → Edit OPENROUTER_API_KEY
   → Paste new key
   ```

4. **Update .env.local** with new secret

5. **Monitor usage**
   - Check API call logs for unauthorized usage
   - Monitor GitHub Actions runs
   - Check AWS usage if applicable

### If Exposed in Git History

**Never try to hide it!** Instead:

1. Use `git filter-branch` to remove from history:
   ```bash
   FILTER_BRANCH_SQUELCH_WARNING=1 \
   git filter-branch --tree-filter \
     'grep -r "exposed_key" . && echo "Found it" || true' \
     --prune-empty -f HEAD
   ```

2. Force push (⚠️ only if no one else has pulled):
   ```bash
   git push origin --force-with-lease main
   ```

3. Notify GitHub that secret was exposed:
   - GitHub auto-detects and sends notifications
   - Follow their guidance to invalidate the secret

4. Contact API provider to invalidate the old key

---

## ✅ Security Checklist

Before committing code, verify:

- [ ] No `.env` files in staged changes
- [ ] No API keys in code or documentation
- [ ] No AWS credentials in commits
- [ ] No SSH private keys in repository
- [ ] All secrets in `.env.local` (git-ignored)
- [ ] GitHub Actions secrets configured
- [ ] Pre-commit hooks are installed and running
- [ ] No "sk-or-v1" or "github_pat_" strings in code

**Check all at once:**
```bash
git diff --cached | grep -iE "sk-or|github_pat|password|secret|api.?key"
```

If nothing appears, you're good!

---

## 🔐 Best Practices

### DO ✅

- ✅ Store secrets in `.env.local`
- ✅ Use GitHub Actions secrets for production
- ✅ Rotate keys regularly
- ✅ Use strong, unique API keys
- ✅ Check `.env.local` into local .gitignore
- ✅ Use environment variables in code
- ✅ Document which env vars are required
- ✅ Keep .env.example as a template only

### DON'T ❌

- ❌ Commit `.env` to GitHub
- ❌ Share API keys in Slack/Discord/Email
- ❌ Hardcode secrets in Python files
- ❌ Use the same key for multiple services
- ❌ Commit credentials.json or secrets.json
- ❌ Share .env.local with anyone
- ❌ Post API keys in GitHub issues
- ❌ Use `git commit --no-verify` to skip hooks

---

## 🔍 Audit Your Code

To verify no secrets exist in your code:

```bash
# Check git history for patterns
git log -p --all | grep -i "sk-or\|github_pat\|password\|secret\|api.key" | head -20

# Check all files for patterns
grep -r "sk-or\|github_pat\|api_key" . --exclude-dir=.git --exclude-dir=__pycache__ 2>/dev/null

# Check staged changes
git diff --cached | grep -i "api\|key\|secret\|token"

# Use pre-commit to scan
pre-commit run --all-files
```

---

## 📚 Related Files

- `.env.example` - Template for environment variables (SAFE to commit)
- `.env.local.example` - Template for local secrets (SAFE to commit)
- `.env` - Local environment (git-ignored, NEVER commit)
- `.env.local` - Local secrets (git-ignored, NEVER commit)
- `.githooks/pre-commit` - Local commit hook that detects secrets
- `.pre-commit-config.yaml` - Pre-commit framework configuration
- `.gitignore` - Git ignore rules for all sensitive files

---

## 🛠️ Tools Used

### GitHub Push Protection
- **Built-in:** GitHub Actions secret scanning
- **Coverage:** All API keys, tokens, credentials
- **Response:** Blocks push and notifies user

### Pre-Commit Hooks
- **Tool:** Bash script at `.githooks/pre-commit`
- **Triggers:** Before every local commit
- **Coverage:** All forbidden patterns and .env files

### .gitignore
- **Prevents:** Accidental commits of secret files
- **Comprehensive:** Matches all known secret file patterns

### Environment Variables
- **Secure:** Secrets never stored in code
- **Flexible:** Different values per environment
- **Testable:** Easy to override for testing

---

## 📖 Further Reading

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://owasp.org/www-community/Sensitive_Data_Exposure)
- [Pre-commit Framework](https://pre-commit.com/)
- [Git Hooks Documentation](https://git-scm.com/docs/githooks)

---

## 📞 Need Help?

If you accidentally commit a secret:

1. **Don't panic** - We have multiple layers of protection
2. **Stop pushing** - Prevent it from spreading
3. **Rotate the key** - Make the old one invalid
4. **Follow the steps** above in "If Exposed in Git History"
5. **Document** - Note what happened so we can improve

Remember: **Prevention is better than cure!**

---

**Last Updated:** January 15, 2026  
**Status:** ✅ All security measures implemented  
**Review:** Monthly recommended

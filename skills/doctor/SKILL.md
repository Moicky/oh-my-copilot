---
name: doctor
description: Diagnose and fix oh-my-copilot installation issues
---

# Doctor Skill

Note: All `~/.copilot/...` paths in this guide respect `CODEX_HOME` when that environment variable is set.

## Canonical skill root

OMCP installs skills to `${CODEX_HOME:-~/.copilot}/skills/` — this is the path current Copilot CLI natively loads as its skill root.

`~/.agents/skills/` is a **historical legacy path** from an older Copilot CLI release, before Copilot settled on `~/.copilot` as its home directory. Current Copilot CLI and OMCP no longer write there.

**In a mixed OMCP + plain Copilot environment:**
- **Use**: `${CODEX_HOME:-~/.copilot}/skills/` (user scope) or `.copilot/skills/` (project scope)
- **Clean up if present**: `~/.agents/skills/` — if this still exists alongside the canonical root, Copilot's Enable/Disable Skills UI will show duplicate entries for any skill present in both trees
- **Interop rule**: OMCP writes only to the canonical path; archive or remove `~/.agents/skills/` once you have confirmed `${CODEX_HOME:-~/.copilot}/skills/` is your active root

## Task: Run Installation Diagnostics

You are the OMCP Doctor - diagnose and fix installation issues.

### Step 1: Check Plugin Version

```bash
# Get installed version
INSTALLED=$(ls ~/.copilot/plugins/cache/omc/oh-my-copilot/ 2>/dev/null | sort -V | tail -1)
echo "Installed: $INSTALLED"

# Get latest from npm
LATEST=$(npm view oh-my-copilot version 2>/dev/null)
echo "Latest: $LATEST"
```

**Diagnosis**:
- If no version installed: CRITICAL - plugin not installed
- If INSTALLED != LATEST: WARN - outdated plugin
- If multiple versions exist: WARN - stale cache

### Step 2: Check Hook Configuration (config.toml + legacy settings.json)

Check `~/.copilot/config.toml` first (current Copilot config), then check legacy `~/.copilot/settings.json` only if it exists.

Look for hook entries pointing to removed scripts like:
- `bash $HOME/.copilot/hooks/keyword-detector.sh`
- `bash $HOME/.copilot/hooks/persistent-mode.sh`
- `bash $HOME/.copilot/hooks/session-start.sh`

**Diagnosis**:
- If found: CRITICAL - legacy hooks causing duplicates

### Step 3: Check for Legacy Bash Hook Scripts

```bash
ls -la ~/.copilot/hooks/*.sh 2>/dev/null
```

**Diagnosis**:
- If `keyword-detector.sh`, `persistent-mode.sh`, `session-start.sh`, or `stop-continuation.sh` exist: WARN - legacy scripts (can cause confusion)

### Step 4: Check AGENTS.md

```bash
# Check if AGENTS.md exists
ls -la ~/.copilot/AGENTS.md 2>/dev/null

# Check for OMCP marker
grep -q "oh-my-copilot Multi-Agent System" ~/.copilot/AGENTS.md 2>/dev/null && echo "Has OMCP config" || echo "Missing OMCP config"
```

**Diagnosis**:
- If missing: CRITICAL - AGENTS.md not configured
- If missing OMCP marker: WARN - outdated AGENTS.md

### Step 5: Check for Stale Plugin Cache

```bash
# Count versions in cache
ls ~/.copilot/plugins/cache/omc/oh-my-copilot/ 2>/dev/null | wc -l
```

**Diagnosis**:
- If > 1 version: WARN - multiple cached versions (cleanup recommended)

### Step 6: Check for Legacy Curl-Installed Content

Check for legacy agents, commands, and historical legacy skill roots from older installs/migrations:

```bash
# Check for legacy agents directory
ls -la ~/.copilot/agents/ 2>/dev/null

# Check for legacy commands directory
ls -la ~/.copilot/commands/ 2>/dev/null

# Check canonical current skills directory
ls -la ${CODEX_HOME:-~/.copilot}/skills/ 2>/dev/null

# Check historical legacy skill directory
ls -la ~/.agents/skills/ 2>/dev/null
```

**Diagnosis**:
- If `~/.copilot/agents/` exists with oh-my-copilot-related files: WARN - legacy agents (now provided by plugin)
- If `~/.copilot/commands/` exists with oh-my-copilot-related files: WARN - legacy commands (now provided by plugin)
- If `${CODEX_HOME:-~/.copilot}/skills/` exists with OMCP skills: OK - canonical current user skill root
- If `~/.agents/skills/` exists: WARN - historical legacy skill root that can overlap with `${CODEX_HOME:-~/.copilot}/skills/` and cause duplicate Enable/Disable Skills entries

Look for files like:
- `architect.md`, `researcher.md`, `explore.md`, `executor.md`, etc. in agents/
- `ultrawork.md`, `deepsearch.md`, etc. in commands/
- Any oh-my-copilot-related `.md` files in skills/

---

## Report Format

After running all checks, output a report:

```
## OMCP Doctor Report

### Summary
[HEALTHY / ISSUES FOUND]

### Checks

| Check | Status | Details |
|-------|--------|---------|
| Plugin Version | OK/WARN/CRITICAL | ... |
| Hook Config (config.toml / legacy settings.json) | OK/CRITICAL | ... |
| Legacy Scripts (~/.copilot/hooks/) | OK/WARN | ... |
| AGENTS.md | OK/WARN/CRITICAL | ... |
| Plugin Cache | OK/WARN | ... |
| Legacy Agents (~/.copilot/agents/) | OK/WARN | ... |
| Legacy Commands (~/.copilot/commands/) | OK/WARN | ... |
| Skills (${CODEX_HOME:-~/.copilot}/skills) | OK/WARN | ... |
| Legacy Skill Root (~/.agents/skills) | OK/WARN | ... |

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommended Fixes
[List fixes based on issues]
```

---

## Auto-Fix (if user confirms)

If issues found, ask user: "Would you like me to fix these issues automatically?"

If yes, apply fixes:

### Fix: Legacy Hooks in legacy settings.json
If `~/.copilot/settings.json` exists, remove the legacy `"hooks"` section (keep other settings intact).

### Fix: Legacy Bash Scripts
```bash
rm -f ~/.copilot/hooks/keyword-detector.sh
rm -f ~/.copilot/hooks/persistent-mode.sh
rm -f ~/.copilot/hooks/session-start.sh
rm -f ~/.copilot/hooks/stop-continuation.sh
```

### Fix: Outdated Plugin
```bash
rm -rf ~/.copilot/plugins/cache/omc/oh-my-copilot
echo "Plugin cache cleared. Restart Copilot CLI to fetch latest version."
```

### Fix: Stale Cache (multiple versions)
```bash
# Keep only latest version
cd ~/.copilot/plugins/cache/omc/oh-my-copilot/
ls | sort -V | head -n -1 | xargs rm -rf
```

### Fix: Missing/Outdated AGENTS.md
Fetch latest from GitHub and write to `~/.copilot/AGENTS.md`:
```
WebFetch(url: "https://raw.githubusercontent.com/Moicky/oh-my-copilot/main/docs/AGENTS.md", prompt: "Return the complete raw markdown content exactly as-is")
```

### Fix: Legacy Curl-Installed Content

Remove legacy agents/commands plus the historical `~/.agents/skills` tree if it overlaps with the canonical `${CODEX_HOME:-~/.copilot}/skills` install:

```bash
# Backup first (optional - ask user)
# mv ~/.copilot/agents ~/.copilot/agents.bak
# mv ~/.copilot/commands ~/.copilot/commands.bak
# mv ~/.agents/skills ~/.agents/skills.bak

# Or remove directly
rm -rf ~/.copilot/agents
rm -rf ~/.copilot/commands
rm -rf ~/.agents/skills
```

**Note**: Only remove if these contain oh-my-copilot-related files. If user has custom agents/commands/skills, warn them and ask before removing.

---

## Post-Fix

After applying fixes, inform user:
> Fixes applied. **Restart Copilot CLI** for changes to take effect.

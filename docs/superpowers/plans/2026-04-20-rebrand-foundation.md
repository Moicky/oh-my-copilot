# Rebrand & Packaging Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the forked `oh-my-copilot` repository to `oh-my-copilot` (OMCP) end-to-end — packaging, manifests, source identifiers, file/dir names, docs — without yet altering its functional integration with the external `codex` CLI (that lives in sub-projects #2+).

**Architecture:** Six ordered phases, each landing one or more git commits. Phase A locks in identity manifests; Phase B renames files/dirs with `git mv` to preserve history; Phase C runs scoped mechanical token replacements; Phase D rewrites identity-bearing docs; Phase E deletes upstream-historical content and non-English translations; Phase F verifies builds and audits residual brand tokens. References to the external `codex` CLI binary, `~/.codex/`, `CODEX_HOME`, and `@openai/codex` are intentionally preserved.

**Tech Stack:** Node.js 20+, TypeScript (Biome lint), Rust workspace (5 crates), npm, cargo, ripgrep (`rg`), git.

**Spec:** `docs/superpowers/specs/2026-04-20-rebrand-foundation-design.md`

---

## File Structure

### Files modified (no rename)
- `package.json` — name/version/description/bin/scripts/repository
- `Cargo.toml` (workspace root) — members paths, repository, version
- `dist-workspace.toml` — version/repository if referenced
- `crates/omcp-*/Cargo.toml` (all 5, after rename) — package name + inter-crate deps
- `Cargo.lock` — regenerated
- `package-lock.json` — regenerated
- `README.md` — full rewrite (not a token rename)
- `CHANGELOG.md` — replaced contents
- `RELEASE_BODY.md` — replaced contents
- `CONTRIBUTING.md`, `DEMO.md`, `COVERAGE.md` — token rename + manual scrub
- `docs/_config.yml`, `docs/index.html`, `docs/getting-started.html`, `docs/agents.html`, `docs/skills.html`, `docs/integrations.html` — token rename + dead-link scrub
- `.github/workflows/{ci,pr-check,release,dev-merge-issue-close}.yml` — token rename + hard-coded crate path arrays + npm-publish target
- `.github/ISSUE_TEMPLATE/{bug_report,feature_request,config}.{md,yml}` — token rename + Discord link removal
- `.github/PULL_REQUEST_TEMPLATE.md` — token rename
- All TypeScript / Rust source files containing the brand tokens `omcp`, `OMCP`, `oh-my-copilot`, `.omcp/`, `omcp-` (crate prefix), or `Moicky/oh-my-copilot`

### Files renamed (git mv)
- `crates/omcp-explore/`           → `crates/omcp-explore/`
- `crates/omcp-mux/`               → `crates/omcp-mux/`
- `crates/omcp-runtime/`           → `crates/omcp-runtime/`
- `crates/omcp-runtime-core/`      → `crates/omcp-runtime-core/`
- `crates/omcp-sparkshell/`        → `crates/omcp-sparkshell/`
- `src/cli/omcp.ts`                → `src/cli/omcp.ts`
- `skills/omcp-setup/`             → `skills/omcp-setup/`
- `docs/shared/omcp-character-spark-initiative.jpg` → **deleted** (Phase E)

### Files deleted
- `docs/readme/README.{de,el,es,fr,it,ja,ko,pl,pt,ru,tr,uk,vi,zh,zh-TW}.md` (15 files)
- `docs/release-notes-*.md`, `docs/release-body-*.md`, `docs/qa-plan-*.md`, `docs/qa-report-*.md`, `docs/migration-*.md`, `docs/prompt-migration-changelog.md` (33 files)
- `docs/openclaw-integration.{de,es,fr,it,ja,ko,pt,ru,tr,uk,vi,zh,zh-TW}.md` (13 files; English `openclaw-integration.md` kept)
- `docs/prs/`, `docs/issues/` (entire directories)
- `docs/shared/omcp-character-spark-initiative.jpg`

### Test strategy
This sub-project does **not** add new behavior, so we don't write new functional unit tests. Verification is:
1. `npm run build` succeeds.
2. `cargo build --workspace` succeeds.
3. `cargo metadata --format-version=1` lists exactly 5 `omcp-*` packages.
4. `node dist/cli/omcp.js --help` runs without crashing on identity-only paths and prints **no** `OMCP`/`omcp`/`oh-my-copilot` strings.
5. Final ripgrep audit returns only the explicitly-allowed brand survivors (fork-attribution line + intentional upstream link).

Existing test suites that exercise Codex integration are expected to fail after this sub-project — we don't run them. We only run the Rust + TypeScript **build** and the explicit audit greps.

---

## Preflight

- [ ] **Step 0a: Confirm clean working tree and create feature branch**

```bash
cd /Users/user/Documents/Personal/oh-my-copilot
git status                       # expect: clean
git checkout -b rebrand/oh-my-copilot
```

Expected: branch created, no untracked or modified tracked files (the spec doc and session plan.md from brainstorming are already committed or live outside the repo).

- [ ] **Step 0b: Verify baseline build works before changing anything**

```bash
npm install
npm run build
cargo build --workspace
```

Expected: all three succeed. If any fail, **stop and report** — the rebrand assumes a working baseline. (`cargo build` of `omcp-runtime` may take several minutes on a cold cache.)

---

## Phase A — Identity manifests

### Task A1: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit identity fields**

Apply these exact edits in `package.json`:

| Field | Old value | New value |
| --- | --- | --- |
| `name` | `"oh-my-copilot"` | `"@moicky/oh-my-copilot"` |
| `version` | `"0.14.0"` | `"0.1.0"` |
| `description` | `"Multi-agent orchestration layer for OpenAI Codex CLI"` | `"Workflow layer for GitHub Copilot CLI (forked from oh-my-copilot)"` |
| `bin.omcp` | `"dist/cli/omcp.js"` | rename key `omcp` → `omcp`, value `"dist/cli/omcp.js"` |
| `repository` | (whatever value is set) | `{"type":"git","url":"git+https://github.com/Moicky/oh-my-copilot.git"}` (add the field if absent) |

In `scripts`, replace every literal `dist/cli/omcp.js` with `dist/cli/omcp.js`. The known affected scripts (verify with `grep '"omcp"\\|omcp\\.js' package.json`):

- `build`            : `... fs.chmodSync('dist/cli/omcp.js', 0o755) ...` → `... fs.chmodSync('dist/cli/omcp.js', 0o755) ...`
- `setup`            : `node dist/cli/omcp.js setup` → `node dist/cli/omcp.js setup`
- `doctor`           : `node dist/cli/omcp.js doctor` → `node dist/cli/omcp.js doctor`

In `scripts`, also replace `cargo build -p omcp-explore-harness` → `cargo build -p omcp-explore-harness` and `cargo test -p omcp-explore-harness` → `cargo test -p omcp-explore-harness`. And `OMCP_COMPAT_TARGET=./target/debug/omcp` → `OMCP_COMPAT_TARGET=./target/debug/omcp`.

Do **not** change references to `@openai/codex`, `codex`, `.codex/`, or `CODEX_HOME` anywhere — those are out of scope.

- [ ] **Step 2: Verify the JSON parses**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).name)"
```

Expected output: `@moicky/oh-my-copilot`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(rebrand): rename npm package to @moicky/oh-my-copilot, bin omcp, version 0.1.0"
```

---

### Task A2: Rename Cargo workspace members

**Files:**
- Modify: `Cargo.toml` (workspace root)

- [ ] **Step 1: Update workspace members and metadata**

In `Cargo.toml`, replace the `[workspace] members` array:

```toml
[workspace]
members = [
  "crates/omcp-explore",
  "crates/omcp-mux",
  "crates/omcp-runtime-core",
  "crates/omcp-runtime",
  "crates/omcp-sparkshell",
]
resolver = "2"
```

In `[workspace.package]`, set:

```toml
version = "0.1.0"
edition = "2021"
license = "MIT"
repository = "https://github.com/Moicky/oh-my-copilot"
```

- [ ] **Step 2: Confirm TOML still parses (cargo will reject directories that don't exist yet — that's expected, we just sanity-check syntax)**

```bash
python3 -c "import tomllib; tomllib.loads(open('Cargo.toml').read()); print('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add Cargo.toml
git commit -m "chore(rebrand): rename Cargo workspace members to omcp-* and bump to 0.1.0"
```

---

### Task A3: Update `dist-workspace.toml` if it references the old identity

**Files:**
- Modify: `dist-workspace.toml`

- [ ] **Step 1: Inspect**

```bash
cat dist-workspace.toml
```

- [ ] **Step 2: Apply edits**

If the file mentions `oh-my-copilot`, `Yeachan-Heo`, `omcp-`, or `OMCP`, update those tokens using the rules:
- `oh-my-copilot` → `oh-my-copilot`
- `Moicky/oh-my-copilot` → `Moicky/oh-my-copilot`
- `omcp-` (crate name prefix only) → `omcp-`

If it doesn't mention any of these, skip the edits.

- [ ] **Step 3: Commit (skip if no changes)**

```bash
git add dist-workspace.toml
git diff --cached --quiet || git commit -m "chore(rebrand): update dist-workspace.toml identity"
```

---

## Phase B — Directory & file renames

### Task B1: Rename Cargo crate directories

**Files:**
- Rename: `crates/omcp-explore` → `crates/omcp-explore`
- Rename: `crates/omcp-mux` → `crates/omcp-mux`
- Rename: `crates/omcp-runtime` → `crates/omcp-runtime`
- Rename: `crates/omcp-runtime-core` → `crates/omcp-runtime-core`
- Rename: `crates/omcp-sparkshell` → `crates/omcp-sparkshell`

- [ ] **Step 1: Run `git mv` for each crate**

```bash
git mv crates/omcp-explore       crates/omcp-explore
git mv crates/omcp-mux           crates/omcp-mux
git mv crates/omcp-runtime       crates/omcp-runtime
git mv crates/omcp-runtime-core  crates/omcp-runtime-core
git mv crates/omcp-sparkshell    crates/omcp-sparkshell
```

- [ ] **Step 2: Verify the directories moved and history is preserved**

```bash
ls crates/
git status --short | head
```

Expected: `crates/` lists 5 `omcp-*` directories. `git status` shows the renames as `R` entries.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(rebrand): git mv crates/omcp-* -> crates/omcp-*"
```

---

### Task B2: Update each crate's `Cargo.toml` package name and inter-crate deps

**Files:**
- Modify: `crates/omcp-explore/Cargo.toml`
- Modify: `crates/omcp-mux/Cargo.toml`
- Modify: `crates/omcp-runtime/Cargo.toml`
- Modify: `crates/omcp-runtime-core/Cargo.toml`
- Modify: `crates/omcp-sparkshell/Cargo.toml`

- [ ] **Step 1: Apply edits per crate**

In `crates/omcp-explore/Cargo.toml`:
- `name = "omcp-explore-harness"`     → `name = "omcp-explore-harness"`  (appears twice: `[package].name` and `[[bin]].name`)

In `crates/omcp-mux/Cargo.toml`:
- `name = "omcp-mux"` → `name = "omcp-mux"`

In `crates/omcp-runtime-core/Cargo.toml`:
- `name = "omcp-runtime-core"` → `name = "omcp-runtime-core"`

In `crates/omcp-runtime/Cargo.toml`:
- `name = "omcp-runtime"` → `name = "omcp-runtime"`
- `omcp-mux = { path = "../omcp-mux" }` → `omcp-mux = { path = "../omcp-mux" }`
- `omcp-runtime-core = { path = "../omcp-runtime-core" }` → `omcp-runtime-core = { path = "../omcp-runtime-core" }`

In `crates/omcp-sparkshell/Cargo.toml`:
- `name = "omcp-sparkshell"` → `name = "omcp-sparkshell"`  (appears twice: `[package].name` and `[[bin]].name`)
- `omcp-mux = { path = "../omcp-mux" }` → `omcp-mux = { path = "../omcp-mux" }`

- [ ] **Step 2: Regenerate `Cargo.lock` and confirm the workspace builds**

```bash
cargo build --workspace
```

Expected: build succeeds. The very first invocation will rewrite `Cargo.lock` with the new package names. (Cold-cache build may take several minutes.)

If build fails because a Rust source file has `use omx_mux::…` or similar, **stop**: that's a Rust crate identifier that the loose token rename in Phase C will catch — but here it surfaces because we're building before Phase C runs. **Resolution:** apply the minimum-needed Rust source rewrite only for the failing identifiers (`omx_mux` → `omcp_mux`, `omx_runtime_core` → `omcp_runtime_core`) right now in this task, then re-run `cargo build`. Document each file you had to touch in the commit message.

- [ ] **Step 3: Verify package list**

```bash
cargo metadata --format-version=1 --no-deps | python3 -c "import sys,json; d=json.load(sys.stdin); names=sorted(p['name'] for p in d['packages']); print(names)"
```

Expected output (exact): `['omcp-explore-harness', 'omcp-mux', 'omcp-runtime', 'omcp-runtime-core', 'omcp-sparkshell']`

- [ ] **Step 4: Commit**

```bash
git add crates/ Cargo.lock
git commit -m "chore(rebrand): rename Cargo packages omcp-* -> omcp-* and update inter-crate deps"
```

---

### Task B3: Rename TypeScript CLI entry and skill directory

**Files:**
- Rename: `src/cli/omcp.ts` → `src/cli/omcp.ts`
- Rename: `skills/omcp-setup/` → `skills/omcp-setup/`

- [ ] **Step 1: Run `git mv`**

```bash
git mv src/cli/omcp.ts src/cli/omcp.ts
git mv skills/omcp-setup skills/omcp-setup
```

- [ ] **Step 2: Audit for any other `*omcp*` filenames we missed**

```bash
find . -name '*omcp*' -not -path './node_modules/*' -not -path './target/*' -not -path './dist/*' -not -path './.git/*'
```

Expected output: only `docs/prs/experimental-dev-omcp-sparkshell.md` (will be deleted in Phase E) and `docs/shared/omcp-character-spark-initiative.jpg` (will be deleted in Phase E). If anything else appears, `git mv` it now applying the same `omcp` → `omcp` rule and re-run the audit.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(rebrand): git mv src/cli/omcp.ts src/cli/omcp.ts and skills/omcp-setup -> skills/omcp-setup"
```

---

## Phase C — Mechanical token rename

This phase runs scoped, exact-token replacements across remaining tracked source. Each rule is run separately so you can audit the diff per rule.

### Task C1: Define the scoped file set

- [ ] **Step 1: Compute the file set once and stash it for the next tasks**

```bash
git ls-files \
  ':!node_modules' ':!dist' ':!target' \
  ':!Cargo.lock' ':!package-lock.json' \
  ':!docs/readme/README.*.md' \
  ':!docs/release-notes-*.md' ':!docs/release-body-*.md' \
  ':!docs/qa-*.md' ':!docs/migration-*.md' \
  ':!docs/prompt-migration-changelog.md' \
  ':!docs/openclaw-integration.*.md' \
  ':!docs/prs/**' ':!docs/issues/**' \
  ':!docs/shared/omcp-character-spark-initiative.jpg' \
  ':!docs/superpowers/specs/2026-04-20-rebrand-foundation-design.md' \
  > /tmp/omcp-rename-files.txt
wc -l /tmp/omcp-rename-files.txt
```

Expected: a few thousand files. The exclusion list mirrors Phase E deletion targets and the spec doc itself (which intentionally retains old token names as historical reference).

The `openclaw-integration.md` (English) is **not** excluded — it gets rebranded.

> **Note:** `docs/openclaw-integration.md` may contain the literal string `openclaw` (a third-party tool) and references to `omcp-*` crates that no longer exist. The token rename will only flip `omcp-` → `omcp-` and `OMCP`/`omcp` brand tokens; it won't touch the third-party tool name.

### Task C2: Rule 1 — `oh-my-copilot` → `oh-my-copilot`

- [ ] **Step 1: Apply substitution to all files in the file set**

```bash
xargs -a /tmp/omcp-rename-files.txt -I{} sh -c '
  if grep -lF "oh-my-copilot" "$1" >/dev/null 2>&1; then
    perl -i -pe "s|oh-my-copilot|oh-my-copilot|g" "$1"
  fi
' _ {}
```

- [ ] **Step 2: Verify**

```bash
git diff --stat | tail -5
rg "oh-my-copilot" $(cat /tmp/omcp-rename-files.txt) | head
```

Expected: many files changed. The `rg` follow-up should print **nothing** (no remaining `oh-my-copilot` in the in-scope file set).

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore(rebrand): replace 'oh-my-copilot' with 'oh-my-copilot' in source"
```

### Task C3: Rule 2 — `Moicky/oh-my-copilot` (intermediate) → `Moicky/oh-my-copilot`

After C2, any URL like `Moicky/oh-my-copilot` is now `Moicky/oh-my-copilot`, which is wrong. Fix it.

- [ ] **Step 1: Apply substitution**

```bash
xargs -a /tmp/omcp-rename-files.txt -I{} sh -c '
  if grep -lF "Moicky/oh-my-copilot" "$1" >/dev/null 2>&1; then
    perl -i -pe "s|Moicky/oh-my-copilot|Moicky/oh-my-copilot|g" "$1"
  fi
' _ {}
```

- [ ] **Step 2: Verify**

```bash
rg "Moicky/oh-my-copilot" $(cat /tmp/omcp-rename-files.txt)
```

Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore(rebrand): point repository URLs at Moicky/oh-my-copilot"
```

### Task C4: Rule 3 — `OMCP` → `OMCP` (uppercase brand abbreviation)

- [ ] **Step 1: Apply substitution (word-boundary aware)**

```bash
xargs -a /tmp/omcp-rename-files.txt -I{} sh -c '
  if grep -l "\\bOMX\\b" "$1" >/dev/null 2>&1; then
    perl -i -pe "s/\\bOMX\\b/OMCP/g" "$1"
  fi
' _ {}
```

- [ ] **Step 2: Verify no stray uppercase OMCP remains**

```bash
rg "\\bOMX\\b" $(cat /tmp/omcp-rename-files.txt)
```

Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore(rebrand): replace OMCP brand abbreviation with OMCP"
```

### Task C5: Rule 4 — lowercase `omcp` (binary name, identifier) → `omcp`

This is the most invasive rule and uses a word-boundary regex to avoid touching arbitrary substrings. We deliberately handle the Rust crate prefix in a separate rule (C6) so this rule can stay narrow.

- [ ] **Step 1: Apply substitution to non-Rust source first (Rust files handled in C6)**

```bash
grep -v '\.rs$' /tmp/omcp-rename-files.txt > /tmp/omcp-rename-files-nonrust.txt
xargs -a /tmp/omcp-rename-files-nonrust.txt -I{} sh -c '
  if grep -l "\\bomx\\b" "$1" >/dev/null 2>&1; then
    perl -i -pe "s/\\bomx\\b/omcp/g" "$1"
  fi
' _ {}
```

- [ ] **Step 2: Verify**

```bash
rg "\\bomx\\b" $(cat /tmp/omcp-rename-files-nonrust.txt)
```

Expected: empty output.

- [ ] **Step 3: Build TS to ensure references resolve**

```bash
npm run build
```

Expected: succeeds. If it fails with "cannot find module" pointing at an old `omcp` path, identify the bad reference and fix it inline (it would be a hardcoded string the regex didn't catch — usually inside a template literal with hyphens, e.g. `omcp-foo`, which is correct to leave alone for now). Document any extra fixes in the commit.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore(rebrand): replace lowercase 'omcp' with 'omcp' in non-Rust source"
```

### Task C6: Rule 5 — Rust crate identifiers (`omx_*` and `omcp-*`) → `omcp_*` / `omcp-*`

Rust uses `_` in `use` statements and `-` in `Cargo.toml`. Apply both.

- [ ] **Step 1: Update Rust source files**

```bash
grep '\.rs$' /tmp/omcp-rename-files.txt > /tmp/omcp-rename-files-rust.txt
xargs -a /tmp/omcp-rename-files-rust.txt -I{} sh -c '
  perl -i -pe "s/\\bomx_(mux|runtime|runtime_core|sparkshell|explore_harness)\\b/omcp_\$1/g; s/\\bomx-(mux|runtime|runtime-core|sparkshell|explore-harness)\\b/omcp-\$1/g; s/\\bomx\\b/omcp/g" "$1"
' _ {}
```

- [ ] **Step 2: Verify Rust builds**

```bash
cargo build --workspace
```

Expected: succeeds.

- [ ] **Step 3: Verify no stray `omcp` Rust identifiers remain**

```bash
rg '\bomx[_-]' $(cat /tmp/omcp-rename-files-rust.txt)
rg '\bomx\b' $(cat /tmp/omcp-rename-files-rust.txt)
```

Expected: both empty.

- [ ] **Step 4: Commit**

```bash
git add -u Cargo.lock
git commit -m "chore(rebrand): replace omcp Rust identifiers with omcp"
```

### Task C7: Rule 6 — state directory `.omcp/` → `.omcp/`

- [ ] **Step 1: Apply substitution**

```bash
xargs -a /tmp/omcp-rename-files.txt -I{} sh -c '
  if grep -l "\\.omcp" "$1" >/dev/null 2>&1; then
    perl -i -pe "s|\\.omcp/|.omcp/|g; s|\\.omcp\\b|.omcp|g" "$1"
  fi
' _ {}
```

- [ ] **Step 2: Verify**

```bash
rg '\.omcp\b' $(cat /tmp/omcp-rename-files.txt)
```

Expected: empty output.

- [ ] **Step 3: Build to confirm nothing broke**

```bash
npm run build
cargo build --workspace
```

Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "chore(rebrand): rename state directory .omcp -> .omcp"
```

### Task C8: Rule 7 — `OMCP_` env-var prefix → `OMCP_`

- [ ] **Step 1: Apply substitution**

```bash
xargs -a /tmp/omcp-rename-files.txt -I{} sh -c '
  if grep -l "OMCP_" "$1" >/dev/null 2>&1; then
    perl -i -pe "s/\\bOMX_/OMCP_/g" "$1"
  fi
' _ {}
```

- [ ] **Step 2: Verify**

```bash
rg "\\bOMX_" $(cat /tmp/omcp-rename-files.txt)
```

Expected: empty output.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore(rebrand): rename OMCP_* env vars to OMCP_*"
```

---

## Phase D — Documentation rewrite

### Task D1: Rewrite `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace contents wholesale**

Replace the file with exactly this content:

```markdown
# oh-my-copilot (OMCP)

> **Status:** 🚧 Early fork — runtime is being ported from OpenAI Codex CLI to GitHub Copilot CLI. **Most commands do not work yet.** See `docs/superpowers/specs/` for the porting roadmap.

> Forked from [oh-my-copilot](https://github.com/Moicky/oh-my-copilot) by Yeachan Heo. Re-targeted at GitHub Copilot CLI.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## What this is

A workflow layer that aims to add prompts, skills, and runtime helpers on top of [GitHub Copilot CLI](https://github.com/github/copilot-cli). The original project (`oh-my-copilot`, OMCP) wrapped OpenAI's Codex CLI; this fork (`oh-my-copilot`, OMCP) is in the process of being re-targeted at Copilot CLI.

## Current state

This `0.1.0` release is a **rebrand only**:

- Project, package, binary, crates, and docs renamed to the OMCP / `oh-my-copilot` identity.
- All references to the external `codex` CLI runtime are still in place — they will be migrated in subsequent releases.
- **Building works; runtime commands targeting Copilot CLI do not work yet.**

## Roadmap

The full Codex-to-Copilot port is decomposed into sequential sub-projects:

1. ✅ Rebrand & packaging foundation (this release)
2. ⏳ Runtime invocation layer (`codex exec` → Copilot CLI equivalents)
3. ⏳ Config & instruction surface (`.codex/` → `~/.copilot/`, `AGENTS.md`)
4. ⏳ Hook system redesign
5. ⏳ Skills & prompts catalog migration to Copilot CLI plugin format
6. ⏳ Team mode rebuilt around Copilot's `/fleet` and `/delegate`
7. ⏳ Auxiliary subsystems (Rust crates, wiki MCP, OpenClaw, HUD)

Specs live under `docs/superpowers/specs/`.

## Building from source

Requirements: Node.js 20+, Rust stable, `cargo`.

```bash
npm install
npm run build
cargo build --workspace
```

The compiled CLI is at `dist/cli/omcp.js`. It will currently fail at runtime against Copilot CLI; that's expected pre-sub-project-2.

## License

MIT. See `LICENSE`. The MIT license of the upstream project is retained; attribution above satisfies its terms.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(rebrand): rewrite README for oh-my-copilot fork status"
```

### Task D2: Reset `CHANGELOG.md`

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Replace contents**

Replace the file with exactly:

```markdown
# Changelog

## 0.1.0 — 2026-04-20

Initial fork from [oh-my-copilot](https://github.com/Moicky/oh-my-copilot) `0.14.0`. Renamed to `oh-my-copilot` (OMCP).

This release is **identity-only**: rebranding, package rename to `@moicky/oh-my-copilot`, binary rename to `omcp`, Cargo crates renamed to `omcp-*`, state directory renamed to `.omcp/`, and pruning of upstream-historical documentation. The runtime is **not yet** ported to GitHub Copilot CLI — that work is tracked in subsequent sub-projects (see `docs/superpowers/specs/`).
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(rebrand): reset CHANGELOG to v0.1.0 fork entry"
```

### Task D3: Rewrite `RELEASE_BODY.md`

**Files:**
- Modify: `RELEASE_BODY.md`

- [ ] **Step 1: Replace contents**

```markdown
oh-my-copilot 0.1.0 — Initial fork

Renamed and rebranded from [oh-my-copilot 0.14.0](https://github.com/Moicky/oh-my-copilot). The runtime port to GitHub Copilot CLI is in progress; this release is identity-only and not functional. See README for status.
```

- [ ] **Step 2: Commit**

```bash
git add RELEASE_BODY.md
git commit -m "docs(rebrand): replace RELEASE_BODY with v0.1.0 fork notice"
```

### Task D4: Manually scrub `CONTRIBUTING.md`, `DEMO.md`, `COVERAGE.md`

**Files:**
- Modify: `CONTRIBUTING.md`, `DEMO.md`, `COVERAGE.md`

- [ ] **Step 1: Inspect each file for community/runtime claims that the rebrand left awkward**

```bash
for f in CONTRIBUTING.md DEMO.md COVERAGE.md; do
  echo "=== $f ==="
  grep -nE "Discord|community|maintainer|ambassador|collaborator|character|website|yeachan-heo|patreon|sponsor" "$f" || echo "  (no flagged content)"
done
```

- [ ] **Step 2: Edit each file**

For any flagged lines: delete or rewrite them so the document no longer points at the upstream community surfaces. Keep general contribution/dev guidance intact. The previous Phase C runs already changed brand tokens — these edits are only about removing community/runtime references that no longer apply.

If `DEMO.md` contains a tutorial that depends on `codex` working, prepend at the top:

```markdown
> **NOTE:** This demo describes the upstream Codex-CLI workflow. The runtime port to Copilot CLI is in progress; the steps below will not work yet on this fork. See README for status.
```

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md DEMO.md COVERAGE.md
git diff --cached --quiet || git commit -m "docs(rebrand): scrub community/runtime references from CONTRIBUTING/DEMO/COVERAGE"
```

### Task D5: Scrub external image/badge URLs from `README` and any remaining HTML/MD docs

> Phase D1 already produced a clean README; this task confirms no other doc still references `yeachan-heo.github.io` or `api.star-history.com/svg?repos=Yeachan-Heo/...`.

- [ ] **Step 1: Audit remaining hits**

```bash
rg "yeachan-heo\.github\.io|api\.star-history\.com.*Yeachan-Heo|discord\.gg/PUwSMR9XNk" \
  --glob '!node_modules' --glob '!dist' --glob '!target' \
  --glob '!docs/superpowers/specs/2026-04-20-rebrand-foundation-design.md'
```

- [ ] **Step 2: For each hit, delete the line containing it**

(Translations and historical docs in the exclusion list above are already slated for deletion in Phase E and are not in this audit.)

Use the `edit` tool per file. Do not rewrite paragraphs — just remove the offending image tag, badge, or link line.

- [ ] **Step 3: Confirm clean**

```bash
rg "yeachan-heo\.github\.io|api\.star-history\.com.*Yeachan-Heo|discord\.gg/PUwSMR9XNk" \
  --glob '!node_modules' --glob '!dist' --glob '!target' \
  --glob '!docs/superpowers/specs/2026-04-20-rebrand-foundation-design.md'
```

Expected: empty output.

- [ ] **Step 4: Commit**

```bash
git add -u
git diff --cached --quiet || git commit -m "docs(rebrand): strip upstream branding URLs (images, star-history, Discord)"
```

### Task D6: Update `docs/_config.yml` and the docs/*.html landing pages

**Files:**
- Modify: `docs/_config.yml`, `docs/index.html`, `docs/getting-started.html`, `docs/agents.html`, `docs/skills.html`, `docs/integrations.html`

Phase C already touched these for token renames. This task is for residual identity strings (Jekyll site title, page titles, hero copy) and for removing dead links to deleted files.

- [ ] **Step 1: Update `docs/_config.yml`**

Set the site `title` to `oh-my-copilot` and `description` to `Workflow layer for GitHub Copilot CLI (forked from oh-my-copilot)`. Set `repository` to `Moicky/oh-my-copilot` and `url` to whatever GitHub Pages URL applies for the new repo (use `https://moicky.github.io/oh-my-copilot` as default if unsure). Remove any `discord_url` or social keys pointing at upstream community.

- [ ] **Step 2: Edit each HTML file's `<title>`, hero `<h1>`, and any "About" paragraph**

Replace remaining literal phrases that don't survive a token rename. Example:
- `"OMCP is a workflow layer for OpenAI Codex CLI."` → `"OMCP is a workflow layer for GitHub Copilot CLI (forked from oh-my-copilot)."`
- "Built and maintained by …" — delete the line.

- [ ] **Step 3: Remove dead links**

For each HTML file, search for hrefs pointing at files about to be deleted in Phase E and either delete the link or unwrap it to plain text:

```bash
for f in docs/index.html docs/getting-started.html docs/agents.html docs/skills.html docs/integrations.html; do
  rg -n 'release-notes-|release-body-|qa-(plan|report)-|migration-|prs/|issues/|readme/README\.[a-z]+\.md' "$f" || true
done
```

For each result, remove the corresponding `<a href="…">…</a>` (or `<li>` containing it).

- [ ] **Step 4: Commit**

```bash
git add docs/_config.yml docs/*.html
git diff --cached --quiet || git commit -m "docs(rebrand): retitle docs site and remove dead-link references"
```

---

## Phase E — Deletions

### Task E1: Delete non-English README translations

**Files:**
- Delete: `docs/readme/README.{de,el,es,fr,it,ja,ko,pl,pt,ru,tr,uk,vi,zh,zh-TW}.md`

- [ ] **Step 1: Remove**

```bash
git rm docs/readme/README.de.md docs/readme/README.el.md docs/readme/README.es.md \
       docs/readme/README.fr.md docs/readme/README.it.md docs/readme/README.ja.md \
       docs/readme/README.ko.md docs/readme/README.pl.md docs/readme/README.pt.md \
       docs/readme/README.ru.md docs/readme/README.tr.md docs/readme/README.uk.md \
       docs/readme/README.vi.md docs/readme/README.zh.md docs/readme/README.zh-TW.md
```

- [ ] **Step 2: If `docs/readme/` is now empty except for `README.md`, decide whether to keep the dir**

```bash
ls docs/readme/
```

If only an English `README.md` remains and the root `README.md` already covers it, also `git rm docs/readme/README.md` (the canonical README is at the repo root). Delete the directory if empty.

- [ ] **Step 3: Commit**

```bash
git diff --cached --quiet || git commit -m "docs(rebrand): drop 15 non-English README translations"
```

### Task E2: Delete historical docs (release notes, QA, PR write-ups, migration)

**Files:**
- Delete: `docs/release-notes-*.md`, `docs/release-body-*.md`, `docs/qa-plan-*.md`, `docs/qa-report-*.md`, `docs/migration-*.md`, `docs/prompt-migration-changelog.md`

- [ ] **Step 1: Remove**

```bash
git rm docs/release-notes-*.md docs/release-body-*.md \
       docs/qa-plan-*.md docs/qa-report-*.md \
       docs/migration-*.md docs/prompt-migration-changelog.md
```

If a glob matches nothing, that's fine; suppress the error or check first with `ls`.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(rebrand): drop upstream-historical docs (release notes, QA, migration)"
```

### Task E3: Delete non-English OpenClaw integration docs

- [ ] **Step 1: Remove**

```bash
git rm docs/openclaw-integration.de.md docs/openclaw-integration.es.md \
       docs/openclaw-integration.fr.md docs/openclaw-integration.it.md \
       docs/openclaw-integration.ja.md docs/openclaw-integration.ko.md \
       docs/openclaw-integration.pt.md docs/openclaw-integration.ru.md \
       docs/openclaw-integration.tr.md docs/openclaw-integration.uk.md \
       docs/openclaw-integration.vi.md docs/openclaw-integration.zh.md \
       docs/openclaw-integration.zh-TW.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(rebrand): drop non-English OpenClaw integration translations"
```

### Task E4: Delete `docs/prs/` and `docs/issues/` directories

- [ ] **Step 1: Remove**

```bash
git rm -r docs/prs docs/issues
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(rebrand): drop upstream PR write-ups and issue notes"
```

### Task E5: Delete the upstream character image asset

- [ ] **Step 1: Remove**

```bash
git rm docs/shared/omcp-character-spark-initiative.jpg
```

If `docs/shared/` is now empty, the directory will be removed automatically by git.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(rebrand): remove upstream character image"
```

### Task E6: Audit and rebrand `.github/` (issue templates, PR template, workflows)

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `config.yml`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Modify: `.github/workflows/ci.yml`, `pr-check.yml`, `release.yml`, `dev-merge-issue-close.yml`

Phase C already token-renamed these. Tasks here are residual edits.

- [ ] **Step 1: Issue templates — strip Discord/community references**

For each of `bug_report.md`, `feature_request.md`, `config.yml`: remove links to the upstream Discord and any "thank our maintainer" copy. Keep technical fields (reproduction steps, environment) intact.

- [ ] **Step 2: PR template — generic-ify**

In `.github/PULL_REQUEST_TEMPLATE.md`, remove references to upstream-specific processes, community labels, or Yeachan-Heo workflow. Keep boilerplate (description, testing checklist).

- [ ] **Step 3: `release.yml` — fix the hard-coded crate path arrays in the verify-version-sync job**

The Node script inside `release.yml` has two arrays listing crate paths:

```js
const expectedMembers = [
  'crates/omcp-explore',
  ...
];
const manifests = [
  'crates/omcp-explore/Cargo.toml',
  ...
];
```

Phase C should have already converted these (they are JS string literals with `omcp-`, which the regex catches). Verify:

```bash
grep -n "crates/omcp-" .github/workflows/release.yml
```

Expected: empty output. If not, edit the file and replace `crates/omcp-` with `crates/omcp-` in those arrays.

Add a top-of-file comment block to all four workflow files:

```yaml
# Workflows inherited from oh-my-copilot; functional behavior re-validated in
# subsequent sub-projects (#2 onward). Tag/branch triggers retained as-is;
# npm publish step targets the @moicky scope only.
```

- [ ] **Step 4: `release.yml` — npm publish step**

Search for any step that runs `npm publish`:

```bash
rg -n "npm publish" .github/workflows/
```

For each hit, ensure the step either:
(a) sets `publish = false` for now, OR
(b) targets the `@moicky` scope and uses `NPM_TOKEN` from secrets.

Recommended for this rebrand: comment out the `npm publish` step entirely (this fork doesn't publish in v0.1.0). Replace it with:

```yaml
      - name: Skip npm publish (rebrand-only release)
        run: echo "npm publish disabled until runtime port (sub-project #2+) lands"
```

- [ ] **Step 5: Verify workflows still parse as YAML**

```bash
python3 -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]; print('ok')"
```

Expected: `ok`. (`pip install pyyaml` if needed.)

- [ ] **Step 6: Commit**

```bash
git add .github/
git diff --cached --quiet || git commit -m "ci(rebrand): scrub workflows and templates, disable npm publish for v0.1.0"
```

---

## Phase F — Verification

### Task F1: Full build

- [ ] **Step 1: Clean build**

```bash
rm -rf dist target node_modules
npm install
npm run build
cargo build --workspace
```

Expected: all three succeed.

- [ ] **Step 2: Confirm CLI entry exists at the new path**

```bash
test -x dist/cli/omcp.js && echo "ok" || (echo "MISSING"; exit 1)
```

Expected output: `ok`.

### Task F2: Smoke run

- [ ] **Step 1: Invoke `--help` (or the CLI's no-runtime equivalent)**

```bash
node dist/cli/omcp.js --help 2>&1 | tee /tmp/omcp-help.txt | head -40
```

If the CLI errors immediately because some sub-command tries to talk to Codex during help rendering, capture the error message but **don't fix it here** — it belongs to sub-project #2. Only require that `--help` itself produces help text.

- [ ] **Step 2: Confirm output contains no `omcp`/`OMCP`/`oh-my-copilot` strings**

```bash
grep -E "\\bomx\\b|\\bOMX\\b|oh-my-copilot" /tmp/omcp-help.txt && echo "FAIL: stale brand strings in help" || echo "ok"
```

Expected output ends with: `ok`

If it fails, find the source string in the TS sources and fix it (likely a hardcoded help string the regex missed because of unusual punctuation or HTML escaping).

### Task F3: Final audit grep

- [ ] **Step 1: Run the master audit**

```bash
rg -i 'oh-my-copilot|\bomx\b|\bOMX\b|yeachan-heo' \
   -g '!node_modules' -g '!dist' -g '!target' \
   -g '!Cargo.lock' -g '!package-lock.json' \
   -g '!docs/superpowers/specs/2026-04-20-rebrand-foundation-design.md' \
   | tee /tmp/omcp-audit.txt
```

- [ ] **Step 2: Verify only allowed survivors remain**

The only acceptable hits are:
1. `README.md` — the fork-attribution line citing `Moicky/oh-my-copilot`.
2. `CHANGELOG.md` — the fork attribution line.
3. `RELEASE_BODY.md` — the fork attribution line.
4. `LICENSE` — if it still has the original copyright holder name (MIT permits this; do not modify).

Anything else is a miss; fix it inline (apply the appropriate Phase C rule by hand to the missed file) and re-run the audit until clean.

- [ ] **Step 3: Verify Cargo workspace metadata**

```bash
cargo metadata --format-version=1 --no-deps \
  | python3 -c "import sys,json; d=json.load(sys.stdin); names=sorted(p['name'] for p in d['packages']); print(names)"
```

Expected output: `['omcp-explore-harness', 'omcp-mux', 'omcp-runtime', 'omcp-runtime-core', 'omcp-sparkshell']`

- [ ] **Step 4: Commit any audit fixes**

```bash
git add -u
git diff --cached --quiet || git commit -m "chore(rebrand): final audit cleanup"
```

### Task F4: Branch summary commit

- [ ] **Step 1: Confirm tree is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 2: Show the branch's commit log**

```bash
git log --oneline main..HEAD | tee /tmp/omcp-rebrand-log.txt
wc -l /tmp/omcp-rebrand-log.txt
```

Expected: one commit per Task A1–F4 that produced a diff (~25–35 commits).

- [ ] **Step 3: Hand off**

The branch `rebrand/oh-my-copilot` is now ready for review and merge. Sub-project #2 (runtime invocation layer) starts from this branch's tip after merge to `main`.

---

## Self-review notes

- **Spec coverage:** Every spec phase (A–F) maps to a task block; spec deletions, doc rewrites, manifest edits, and audits each have explicit steps and expected outputs.
- **Placeholders:** None remain (all "TBD"-style language was replaced with concrete commands or explicit "do nothing" branches).
- **Type/identifier consistency:** Crate names use `omcp-explore-harness` (binary) consistently; CLI binary is `omcp` consistently; package is `@moicky/oh-my-copilot` consistently; state dir is `.omcp/`.
- **Excluded-from-rename list** is identical between Task C1 (file-set definition) and Task F3 (audit), keeping the sub-project internally consistent.
- **External `codex` CLI references** — verified that no rule in Phase C touches the bare token `codex`, `.codex/`, `CODEX_HOME`, or `@openai/codex`. They survive the rebrand intact, ready for sub-project #2.

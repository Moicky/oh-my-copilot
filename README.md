# oh-my-copilot (OMCP)

> **Status:** 🚧 Early fork — runtime is being ported from OpenAI Codex CLI to GitHub Copilot CLI. **Most commands do not work yet.** See `docs/superpowers/specs/` for the porting roadmap.

> Forked from [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) by Yeachan Heo. Re-targeted at GitHub Copilot CLI.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## What this is

A workflow layer that aims to add prompts, skills, and runtime helpers on top of [GitHub Copilot CLI](https://github.com/github/copilot-cli). The original project (`oh-my-codex`, OMX) wrapped OpenAI's Codex CLI; this fork (`oh-my-copilot`, OMCP) is in the process of being re-targeted at Copilot CLI.

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

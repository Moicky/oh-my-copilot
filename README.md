# oh-my-copilot (OMCP)

> Forked from [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) by Yeachan Heo. Re-targeted at [GitHub Copilot CLI](https://github.com/github/copilot-cli).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## What this is

A workflow layer that adds prompts, skills, and runtime helpers on top of [GitHub Copilot CLI](https://github.com/github/copilot-cli). It installs an opinionated set of skills, prompts and instruction files into `~/.copilot`, runs Copilot via `copilot -p`, and orchestrates multi-agent tmux teams across `copilot` and `claude` workers.

## Current state

The Copilot CLI port is functionally complete:

- ✅ Rebrand & packaging foundation
- ✅ Runtime invocation layer (`copilot -p` everywhere `codex exec` used to be)
- ✅ Config & instruction surface (`~/.copilot/`, `AGENTS.md`, `copilot-instructions.md`)
- ✅ Hook system (writes `~/.copilot/hooks.json`; entries are no-ops until Copilot CLI exposes a hook surface upstream)
- ✅ Skills & prompts catalog scrubbed and re-targeted at Copilot
- ✅ Team mode (tmux-based orchestration) drives `copilot` workers
- ✅ Auxiliary Rust crates (`omcp-explore`, `omcp-sparkshell`) spawn `copilot`

Internal symbol names in the source tree (e.g. `codex_bridge.rs`, `codexConfigFile`, `paneShowsCodexViewport`) have been **intentionally preserved** so this fork can still cleanly merge updates from upstream `oh-my-codex`. They operate on `~/.copilot/` paths and shell out to `copilot`.

## Building from source

Requirements: Node.js 20+, Rust stable, `cargo`, `copilot` v1.0+ on `PATH`.

```bash
npm install
npm run build
cargo build --workspace
```

The compiled CLI is at `dist/cli/omcp.js` (also exposed as `omcp` once installed).

Quick smoke test:

```bash
node dist/cli/omcp.js doctor
```

## License

MIT. See `LICENSE`. The MIT license of the upstream project is retained; attribution above satisfies its terms.

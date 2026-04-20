# Changelog

## Unreleased

- **Sub-project #2 (runtime invocation):** swapped `codex exec` spawn for `copilot -p`. The Rust bridge (`crates/omcp-sparkshell/src/codex_bridge.rs`) and the worker startup pipeline now drive `copilot --allow-all-tools --no-ask-user`. `omcp doctor` reports the Copilot CLI version. Upstream Codex code paths intentionally untouched so we can pull future `oh-my-codex` updates.
- **Sub-project #3 (config & instruction surface):** user-facing strings rebranded `Codex → Copilot` across `omcp setup`, `omcp doctor`, `omcp uninstall`. Internal symbol names (`codexConfigFile`, `parseCodexHooksConfig`, etc.) preserved on purpose so the upstream-mergeable diff stays small; they already point at `$COPILOT_HOME` (defaults to `~/.copilot/`) via `src/utils/paths.ts`.
- **Sub-project #4 (hook system):** Copilot CLI does not currently expose a hook surface comparable to Codex CLI's `hooks.json`. We continue writing `~/.copilot/hooks.json` for forward compatibility, but **the file is a no-op** until upstream support lands. `omcp doctor` notes this on the `Native hooks` check. OMCP-internal tmux/notify infrastructure remains in place; integrations that previously fired from Codex hook events will need follow-up wiring once Copilot exposes equivalents.
- **Sub-project #5 (skills & prompts catalog scrub):** ~30 skill and prompt files cleaned of stale `OMX`, `oh-my-codex`, `Codex CLI`, and `~/.codex/` references. Aspirational `ask_codex` MCP tool name renamed to `ask_copilot` for brand consistency.
- **Sub-project #6 (team mode):** decision recorded — Copilot CLI exposes no `/fleet` or `/delegate` equivalent, so the existing tmux-based `omcp team` orchestration is kept and continues to drive `copilot` workers (already wired in SP2). User-visible prose in `src/team/worker-bootstrap.ts`, `src/team/runtime.ts`, `src/team/tmux-session.ts`, and `src/cli/team.ts` rebranded; internal `*Codex*` symbol names preserved for upstream-mergeable diff.
- **Sub-project #7 (auxiliary subsystems & cleanup):** `crates/omcp-explore` now spawns `copilot` (and accepts `OMCP_EXPLORE_COPILOT_BIN` override; the legacy `OMCP_EXPLORE_CODEX_BIN` name was renamed). `crates/omcp-runtime-core` `WorkerCli` enum gained an explicit `Copilot` variant alongside `Codex`/`Claude`. User-facing error strings in `crates/omcp-sparkshell` (`codex_bridge.rs`, `error.rs`) rebranded. README and DEMO refreshed to reflect that the port is complete.

## 0.1.0 — 2026-04-20

Initial fork from [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) `0.14.0`. Renamed to `oh-my-copilot` (OMCP).

This release is **identity-only**: rebranding, package rename to `@moicky/oh-my-copilot`, binary rename to `omcp`, Cargo crates renamed to `omcp-*`, state directory renamed to `.omcp/`, and pruning of upstream-historical documentation. The runtime is **not yet** ported to GitHub Copilot CLI — that work is tracked in subsequent sub-projects (see `docs/superpowers/specs/`).

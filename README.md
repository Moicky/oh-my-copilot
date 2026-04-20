# oh-my-copilot (OMCP)

<p align="center">
  <img src="https://yeachan-heo.github.io/oh-my-copilot-website/omcp-character-nobg.png" alt="oh-my-copilot character" width="280">
  <br>
  <em>Start Codex stronger, then let OMCP add better prompts, workflows, and runtime help when the work grows.</em>
</p>

[![npm version](https://img.shields.io/npm/v/oh-my-copilot)](https://www.npmjs.com/package/oh-my-copilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Discord](https://img.shields.io/discord/1452487457085063218?color=5865F2&logo=discord&logoColor=white&label=Discord)](https://discord.gg/PUwSMR9XNk)

**Website:** https://yeachan-heo.github.io/oh-my-copilot-website/
**Docs:** [Getting Started](./docs/getting-started.html) · [Agents](./docs/agents.html) · [Skills](./docs/skills.html) · [Integrations](./docs/integrations.html) · [Demo](./DEMO.md) · [OpenClaw guide](./docs/openclaw-integration.md)
**Community:** [Discord](https://discord.gg/PUwSMR9XNk) — shared OMCP/community server for oh-my-copilot and related tooling.

OMCP is a workflow layer for [OpenAI Codex CLI](https://github.com/openai/codex).

<table>
<tr>
<td><strong>🚨 CAUTION — RECOMMENDED DEFAULT ONLY: macOS or Linux with Codex CLI.</strong><br><br><strong>OMCP is primarily designed and actively tuned for that path.</strong><br><strong>Native Windows and Codex App are not the default experience, may break or behave inconsistently, and currently receive less support.</strong></td>
</tr>
</table>

It keeps Codex as the execution engine and makes it easier to:
- start a stronger Codex session by default
- run one consistent workflow from clarification to completion
- invoke the canonical skills with `$deep-interview`, `$ralplan`, `$team`, and `$ralph`
- keep project guidance, plans, logs, and state in `.omcp/`

## Core Maintainers

| Role | Name | GitHub |
| --- | --- | --- |
| Creator & Lead | Yeachan Heo | [@Yeachan-Heo](https://github.com/Yeachan-Heo) |
| Maintainer | HaD0Yun | [@HaD0Yun](https://github.com/HaD0Yun) |

## Ambassadors

| Name | GitHub |
| --- | --- |
| Sigrid Jin | [@sigridjineth](https://github.com/sigridjineth) |

## Top Collaborators

| Name | GitHub |
| --- | --- |
| HaD0Yun | [@HaD0Yun](https://github.com/HaD0Yun) |
| Junho Yeo | [@junhoyeo](https://github.com/junhoyeo) |
| JiHongKim98 | [@JiHongKim98](https://github.com/JiHongKim98) |
| Lor | — |
| HyunjunJeon | [@HyunjunJeon](https://github.com/HyunjunJeon) |

## Recommended default flow

If you want the default OMCP experience, start here:

```bash
npm install -g @openai/codex oh-my-copilot
omcp setup
omcp --madmax --high
```

Then work normally inside Codex:

```text
$deep-interview "clarify the authentication change"
$ralplan "approve the auth plan and review tradeoffs"
$ralph "carry the approved plan to completion"
$team 3:executor "execute the approved plan in parallel"
```

That is the main path.
Before you treat the runtime as ready, run the quick-start smoke test below: `omcp doctor` verifies the install shape, while `omcp exec` proves the active Codex runtime can actually authenticate and complete a model call from the current environment.
Start OMCP strongly, clarify first when needed, approve the plan, then choose `$team` for coordinated parallel execution or `$ralph` for the persistent completion loop.

## What OMCP is for

Use OMCP if you already like Codex and want a better day-to-day runtime around it:
- a standard workflow built around `$deep-interview`, `$ralplan`, `$team`, and `$ralph`
- specialist roles and supporting skills when the task needs them
- project guidance through scoped `AGENTS.md`
- durable state under `.omcp/` for plans, logs, memory, and mode tracking

If you want plain Codex with no extra workflow layer, you probably do not need OMCP.

## Quick start

### Requirements

- Node.js 20+
- Codex CLI installed: `npm install -g @openai/codex`
- Codex auth configured and visible in the same shell/profile that will run OMCP
- `tmux` on macOS/Linux if you want the recommended durable team runtime
- `psmux` on native Windows only if you intentionally want the less-supported Windows team path

### A good first session

After install, check both boundaries:

```bash
omcp doctor
codex login status
omcp exec --skip-git-repo-check -C . "Reply with exactly OMCP-EXEC-OK"
```

`omcp doctor` catches missing OMCP files, hooks, and runtime prerequisites. The real smoke test catches auth, profile, and provider/base-URL problems that only appear when Codex performs an actual request.

Launch OMCP the recommended way:

```bash
omcp --madmax --high
```

This starts the interactive leader session directly by default.
If you explicitly want the leader session in tmux, use:

```bash
omcp --tmux --madmax --high
```

Then try the canonical workflow:

```text
$deep-interview "clarify the authentication change"
$ralplan "approve the safest implementation path"
$ralph "carry the approved plan to completion"
$team 3:executor "execute the approved plan in parallel"
```

Use `$team` when the approved plan needs coordinated parallel work, or `$ralph` when one persistent owner should keep pushing to completion.

## A simple mental model

OMCP does **not** replace Codex.

It adds a better working layer around it:
- **Codex** does the actual agent work
- **OMCP role keywords** make useful roles reusable
- **OMCP skills** make common workflows reusable
- **`.omcp/`** stores plans, logs, memory, and runtime state

Most users should think of OMCP as **better task routing + better workflow + better runtime**, not as a command surface to operate manually all day.

## Start here if you are new

1. Run `omcp setup`
2. Run `omcp doctor`
3. Run a real execution smoke test: `codex login status` and `omcp exec --skip-git-repo-check -C . "Reply with exactly OMCP-EXEC-OK"`
4. Launch with `omcp --madmax --high`
5. Use `$deep-interview "..."` when the request or boundaries are still unclear
6. Use `$ralplan "..."` to approve the plan and review tradeoffs
7. Choose `$team` for coordinated parallel execution or `$ralph` for persistent completion loops

## Recommended workflow

1. `$deep-interview` — clarify scope when the request or boundaries are still vague.
2. `$ralplan` — turn that clarified scope into an approved architecture and implementation plan.
3. `$team` or `$ralph` — use `$team` for coordinated parallel execution, or `$ralph` when you want a persistent completion loop with one owner.

## Common in-session surfaces

| Surface | Use it for |
| --- | --- |
| `$deep-interview "..."` | clarifying intent, boundaries, and non-goals |
| `$ralplan "..."` | approving the implementation plan and tradeoffs |
| `$ralph "..."` | persistent completion and verification loops |
| `$team "..."` | coordinated parallel execution when the work is big enough |
| `/skills` | browsing installed skills and supporting helpers |

## Advanced / operator surfaces

These are useful, but they are not the main onboarding path.

### Team runtime

Use the team runtime when you specifically need durable tmux/worktree coordination, not as the default way to begin using OMCP.

```bash
omcp team 3:executor "fix the failing tests with verification"
omcp team status <team-name>
omcp team resume <team-name>
omcp team shutdown <team-name>
```

### Setup, doctor, and HUD

These are operator/support surfaces:
- `omcp setup` installs prompts, skills, AGENTS scaffolding, `.codex/config.toml`, and OMCP-managed native Codex hooks in `.codex/hooks.json`
  - setup refresh preserves non-OMCP hook entries in `.codex/hooks.json` and only rewrites OMCP-managed wrappers
  - `omcp uninstall` removes OMCP-managed wrappers from `.codex/hooks.json` but keeps the file when user hooks remain
- `omcp doctor` verifies the install when something seems wrong; it does not prove that the active Codex profile can make an authenticated model call
- `omcp hud --watch` is a monitoring/status surface, not the primary user workflow

For non-team sessions, native Codex hooks are now the canonical lifecycle surface:
- `.codex/hooks.json` = native Codex hook registrations
- `.omcp/hooks/*.mjs` = OMCP plugin hooks
- `omcp tmux-hook` / notify-hook / derived watcher = tmux + runtime fallback paths

See [Codex native hook mapping](./docs/codex-native-hooks.md) for the current native / fallback matrix.


### Troubleshooting false-green readiness

A green `omcp doctor` means the install and local runtime wiring look sane. If real execution still fails, check the environment Codex actually uses:

- Run `codex login status` and `omcp exec --skip-git-repo-check -C . "Reply with exactly OMCP-EXEC-OK"` from the same shell/profile that will launch OMCP.
- In custom HOME, profile, container, or service shells, confirm the active `~/.codex` (or `CODEX_HOME`) is the one with the expected auth and config. Do not assume your normal user `~/.codex` is visible there.
- If you depend on a local OpenAI-compatible proxy, confirm the active `~/.codex/config.toml` includes the expected `openai_base_url`; otherwise a proxy-issued key can be sent to the default endpoint and fail with `401 Unauthorized`, `Missing bearer or basic authentication in header`, or `Incorrect API key provided`.
- If `omcp doctor --team` or resume reports a stale team such as `resume_blocker` or a missing tmux session, clean the dead runtime state before retrying:

```bash
omcp team shutdown <team-name> --force --confirm-issues
omcp cancel
omcp doctor --team
```

Only use the forced team shutdown for a team you have confirmed is dead or intentionally abandoned.

If `Shift+Enter` still submits instead of inserting a newline inside an OMCP-managed tmux session, see [Troubleshooting execution readiness](./docs/troubleshooting.md#shiftenter-submits-instead-of-inserting-a-newline-in-tmux-backed-omcp-sessions). Current OMCP already enables tmux extended-key forwarding around its own Codex launch paths, so a persistent failure is usually a tmux terminal-capability/discoverability problem rather than a net-new OMCP feature gap.

### Explore and sparkshell

- `omcp explore --prompt "..."` is for read-only repository lookup
- `omcp sparkshell <command>` is for shell-native inspection and bounded verification
- when `.omcp/wiki/` exists, `omcp explore` can inject wiki-first context before falling back to broader repository search

Examples:

```bash
omcp explore --prompt "find where team state is written"
omcp sparkshell git status
omcp sparkshell --tmux-pane %12 --tail-lines 400
```

### Wiki

- `omcp wiki` is the CLI parity surface for the OMCP wiki MCP server
- wiki data lives locally under `.omcp/wiki/`
- the wiki is markdown-first and search-first, not vector-first

Examples:

```bash
omcp wiki list --json
omcp wiki query --input '{"query":"session-start lifecycle"}' --json
omcp wiki lint --json
omcp wiki refresh --json
```

### Platform notes for team mode

`omcp team` works best on macOS/Linux with `tmux`.
Native Windows remains a secondary path, and WSL2 is generally the better choice if you want a Windows-hosted setup.
On native Windows, OMCP accepts `psmux` as the tmux-compatible binary for the existing tmux-backed paths it already uses.

| Platform | Install |
| --- | --- |
| macOS | `brew install tmux` |
| Ubuntu/Debian | `sudo apt install tmux` |
| Fedora | `sudo dnf install tmux` |
| Arch | `sudo pacman -S tmux` |
| Windows | `winget install psmux` |
| Windows (WSL2) | `sudo apt install tmux` |

## Known issues

### Intel Mac: high `syspolicyd` / `trustd` CPU during startup

On some Intel Macs, OMCP startup — especially with `--madmax --high` — can spike `syspolicyd` / `trustd` CPU usage while macOS Gatekeeper validates many concurrent process launches.

If this happens, try:
- `xattr -dr com.apple.quarantine $(which omcp)`
- adding your terminal app to the Developer Tools allowlist in macOS Security settings
- using lower concurrency (for example, avoid `--madmax --high`)

## Documentation

- [Getting Started](./docs/getting-started.html)
- [Demo guide](./DEMO.md)
- [Wiki feature](./docs/wiki-feature.md)
- [Agent catalog](./docs/agents.html)
- [Skills reference](./docs/skills.html)
- [Codex native hook mapping](./docs/codex-native-hooks.md)
- [Integrations](./docs/integrations.html)
- [Troubleshooting execution readiness](./docs/troubleshooting.md)
- [OpenClaw / notification gateway guide](./docs/openclaw-integration.md)
- [Contributing](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

## Languages

- [English](./README.md)
- [한국어](./docs/readme/README.ko.md)
- [日本語](./docs/readme/README.ja.md)
- [简体中文](./docs/readme/README.zh.md)
- [繁體中文](./docs/readme/README.zh-TW.md)
- [Tiếng Việt](./docs/readme/README.vi.md)
- [Español](./docs/readme/README.es.md)
- [Português](./docs/readme/README.pt.md)
- [Русский](./docs/readme/README.ru.md)
- [Türkçe](./docs/readme/README.tr.md)
- [Deutsch](./docs/readme/README.de.md)
- [Français](./docs/readme/README.fr.md)
- [Italiano](./docs/readme/README.it.md)
- [Ελληνικά](./docs/readme/README.el.md)
- [Polski](./docs/readme/README.pl.md)
- [Українська](./docs/readme/README.uk.md)

## Contributors

| Role | Name | GitHub |
| --- | --- | --- |
| Creator & Lead | Yeachan Heo | [@Yeachan-Heo](https://github.com/Yeachan-Heo) |
| Maintainer | HaD0Yun | [@HaD0Yun](https://github.com/HaD0Yun) |

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Moicky/oh-my-copilot&type=date&legend=top-left)](https://www.star-history.com/#Moicky/oh-my-copilot&type=date&legend=top-left)

## License

MIT

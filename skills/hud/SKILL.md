---
name: "hud"
description: "Show or configure the OMCP HUD (two-layer statusline)"
role: "display"
scope: ".omcp/**"
---

# HUD Skill

The OMCP HUD uses a two-layer architecture:

1. **Layer 1 - Copilot built-in statusLine**: Real-time TUI footer showing model, git branch, and context usage. Configured via `[tui] status_line` in `~/.copilot/config.toml`. Zero code required.

2. **Layer 2 - `omcp hud` CLI command**: Shows OMCP-specific orchestration state (ralph, ultrawork, autopilot, team, pipeline, ecomode, turns). Reads `.omcp/state/` files.

## Quick Commands

| Command | Description |
|---------|-------------|
| `omcp hud` | Show current HUD (modes, turns, activity) |
| `omcp hud --watch` | Live-updating display (polls every 1s) |
| `omcp hud --json` | Raw state output for scripting |
| `omcp hud --preset=minimal` | Minimal display |
| `omcp hud --preset=focused` | Default display |
| `omcp hud --preset=full` | All elements |

## Presets

### minimal
```
[OMCP] ralph:3/10 | turns:42
```

### focused (default)
```
[OMCP] ralph:3/10 | ultrawork | team:3 workers | turns:42 | last:5s ago
```

### full
```
[OMCP] ralph:3/10 | ultrawork | autopilot:execution | team:3 workers | pipeline:exec | turns:42 | last:5s ago | total-turns:156
```

## Setup

`omcp setup` automatically configures both layers:
- Adds `[tui] status_line` to `~/.copilot/config.toml` (Layer 1)
- Writes `.omcp/hud-config.json` with default preset (Layer 2)
- Default preset is `focused`; if HUD/statusline changes do not appear, restart Copilot CLI once.

## Layer 1: Copilot Built-in StatusLine

Configured in `~/.copilot/config.toml`:
```toml
[tui]
status_line = ["model-with-reasoning", "git-branch", "context-remaining"]
```

Available built-in items (Copilot CLI v0.101.0+):
`model-name`, `model-with-reasoning`, `current-dir`, `project-root`, `git-branch`, `context-remaining`, `context-used`, `five-hour-limit`, `weekly-limit`, `copilot-version`, `context-window-size`, `used-tokens`, `total-input-tokens`, `total-output-tokens`, `session-id`

## Layer 2: OMCP Orchestration HUD

The `omcp hud` command reads these state files:
- `.omcp/state/ralph-state.json` - Ralph loop iteration
- `.omcp/state/ultrawork-state.json` - Ultrawork mode
- `.omcp/state/autopilot-state.json` - Autopilot phase
- `.omcp/state/team-state.json` - Team workers
- `.omcp/state/pipeline-state.json` - Pipeline stage
- `.omcp/state/ecomode-state.json` - Ecomode active
- `.omcp/state/hud-state.json` - Last activity (from notify hook)
- `.omcp/metrics.json` - Turn counts

## Configuration

HUD config stored at `.omcp/hud-config.json`:
```json
{
  "preset": "focused"
}
```

## Color Coding

- **Green**: Normal/healthy
- **Yellow**: Warning (ralph >70% of max)
- **Red**: Critical (ralph >90% of max)

## Troubleshooting

If the TUI statusline is not showing:
1. Ensure Copilot CLI v0.101.0+ is installed
2. Run `omcp setup` to configure `[tui]` section
3. Restart Copilot CLI

If `omcp hud` shows "No active modes":
- This is expected when no workflows are running
- Start a workflow (ralph, autopilot, etc.) and check again

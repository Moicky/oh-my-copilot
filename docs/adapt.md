# `omcp adapt`

`omcp adapt <target>` is the OMCP-owned surface for persistent external-agent adaptation.

Shared foundation behavior:

- CLI scaffold for `probe`, `status`, `init`, `envelope`, and `doctor`
- shared capability reporting with explicit ownership (`omcp-owned`, `shared-contract`, `target-observed`)
- adapter-owned paths under `.omcp/adapters/<target>/...`
- shared envelope/status/doctor/init behavior that does not touch `.omcp/state/...`

OpenClaw follow-on behavior:

- `omcp adapt openclaw probe` observes existing local OpenClaw config/env/gateway evidence
- `omcp adapt openclaw status` synthesizes local adapter status from env gates, config source, hook mappings, and command-gateway opt-in
- `omcp adapt openclaw envelope` includes lifecycle bridge metadata for the existing OMCP to OpenClaw event mapping
- `omcp adapt openclaw init --write` still writes only under `.omcp/adapters/openclaw/...`

Current targets:

- `openclaw`
- `hermes`

Hermes follow-on behavior in this worktree:

- `probe` inspects external Hermes ACP, gateway, and session-store evidence
- `status` synthesizes `unavailable` / `installed` / `degraded` / `running` from observable Hermes files only
- `envelope` includes Hermes bootstrap metadata for ACP commands, lifecycle bridge guidance, and status commands
- `init --write` still writes only under `.omcp/adapters/hermes/...`; Hermes runtime files remain read-only inputs

Examples:

```bash
omcp adapt openclaw probe
omcp adapt hermes status --json
omcp adapt openclaw init --write
omcp adapt hermes envelope --json
```

Foundation constraints:

- thin adapter surface only, not a bidirectional control plane
- no direct writes to `.omcp/state/...`
- no direct writes to external runtime internals
- target capability reporting stays asymmetric; OMCP reports what it owns, what is shared, and what is only target-observed
- OpenClaw status is local evidence only; it does not claim downstream runtime acknowledgement or execution
- command-gateway readiness still requires `OMX_OPENCLAW_COMMAND=1`

Hermes-specific evidence discovery uses `HERMES_HOME` plus an overrideable Hermes source root (`OMX_ADAPT_HERMES_ROOT`) so OMCP can inspect an external runtime without vendoring or mutating it.

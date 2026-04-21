import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  COPILOT_MCP_MANAGED_MARKER,
  getUnifiedMcpRegistryCandidates,
  loadUnifiedMcpRegistry,
  planClaudeCodeMcpSettingsSync,
  planCopilotMcpServersRemoval,
  planCopilotMcpServersSync,
  sharedRegistryServerToCopilotEntry,
} from "../mcp-registry.js";

describe("unified MCP registry loader", () => {
  it("prefers ~/.omcp/mcp-registry.json over ~/.omc/mcp-registry.json", async () => {
    const wd = await mkdtemp(join(tmpdir(), "omcp-mcp-registry-"));
    try {
      const omcpPath = join(wd, ".omcp", "mcp-registry.json");
      const omcPath = join(wd, ".omc", "mcp-registry.json");
      await mkdir(join(wd, ".omcp"), { recursive: true });
      await mkdir(join(wd, ".omc"), { recursive: true });

      await writeFile(
        omcpPath,
        JSON.stringify({
          eslint: { command: "npx", args: ["@eslint/mcp@latest"], timeout: 11 },
        }),
      );
      await writeFile(
        omcPath,
        JSON.stringify({
          legacy_helper: { command: "legacy-helper", args: ["mcp"] },
        }),
      );

      const result = await loadUnifiedMcpRegistry({ homeDir: wd });
      assert.equal(result.sourcePath, omcpPath);
      assert.deepEqual(result.servers.map((server) => server.name), ["eslint"]);
      assert.equal(result.servers[0].startupTimeoutSec, 11);
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it("loads a legacy registry when it is passed explicitly as a candidate", async () => {
    const wd = await mkdtemp(join(tmpdir(), "omcp-mcp-registry-"));
    try {
      const omcPath = join(wd, ".omc", "mcp-registry.json");
      await mkdir(join(wd, ".omc"), { recursive: true });
      await writeFile(
        omcPath,
        JSON.stringify({
          legacy_helper: { command: "legacy-helper", args: ["mcp"], enabled: false },
        }),
      );

      const result = await loadUnifiedMcpRegistry({ candidates: [omcPath] });
      assert.equal(result.sourcePath, omcPath);
      assert.equal(result.servers.length, 1);
      assert.equal(result.servers[0].name, "legacy_helper");
      assert.equal(result.servers[0].enabled, false);
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it("skips invalid entries but keeps valid entries from the same file", async () => {
    const wd = await mkdtemp(join(tmpdir(), "omcp-mcp-registry-"));
    try {
      const registryPath = join(wd, "registry.json");
      await writeFile(
        registryPath,
        JSON.stringify({
          bad_type: "not-an-object",
          bad_args: { command: "npx", args: [1, 2, 3] },
          good: { command: "npx", args: ["@eslint/mcp@latest"], timeout: 7 },
        }),
      );

      const result = await loadUnifiedMcpRegistry({
        candidates: [registryPath],
      });
      assert.equal(result.servers.length, 1);
      assert.equal(result.servers[0].name, "good");
      assert.equal(result.servers[0].startupTimeoutSec, 7);
      assert.equal(result.warnings.length >= 2, true);
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it("preserves string approval_mode values and warns on non-string ones", async () => {
    const wd = await mkdtemp(join(tmpdir(), "omcp-mcp-registry-"));
    try {
      const registryPath = join(wd, "registry.json");
      await writeFile(
        registryPath,
        JSON.stringify({
          eslint: {
            command: "npx",
            args: ["@eslint/mcp@latest"],
            approval_mode: "never",
          },
          invalid_mode: {
            command: "npx",
            args: ["@example/mcp"],
            approval_mode: 42,
          },
        }),
      );

      const result = await loadUnifiedMcpRegistry({
        candidates: [registryPath],
      });
      assert.equal(result.servers.length, 2);
      assert.deepEqual(result.servers[0], {
        name: "eslint",
        command: "npx",
        args: ["@eslint/mcp@latest"],
        enabled: true,
        approval_mode: "never",
        startupTimeoutSec: undefined,
      });
      assert.deepEqual(result.servers[1], {
        name: "invalid_mode",
        command: "npx",
        args: ["@example/mcp"],
        enabled: true,
        startupTimeoutSec: undefined,
      });
      assert.deepEqual(result.warnings, [
        'registry entry "invalid_mode" has non-string approval_mode; ignoring approval_mode',
      ]);
    } finally {
      await rm(wd, { recursive: true, force: true });
    }
  });

  it("returns canonical home-based registry candidates", () => {
    const candidates = getUnifiedMcpRegistryCandidates("/tmp/home");
    assert.deepEqual(candidates, ["/tmp/home/.omcp/mcp-registry.json"]);
  });
  it("plans Claude settings sync by adding only missing shared servers", () => {
    const plan = planClaudeCodeMcpSettingsSync(
      JSON.stringify(
        {
          theme: "dark",
          mcpServers: {
            existing_server: {
              command: "custom-existing-server",
              args: ["serve"],
              enabled: true,
            },
          },
        },
        null,
        2,
      ),
      [
        {
          name: "existing_server",
          command: "existing-server",
          args: ["mcp"],
          enabled: true,
        },
        {
          name: "eslint",
          command: "npx",
          args: ["@eslint/mcp@latest"],
          enabled: false,
          startupTimeoutSec: 9,
        },
      ],
    );

    assert.deepEqual(plan.added, ["eslint"]);
    assert.deepEqual(plan.unchanged, ["existing_server"]);
    assert.deepEqual(plan.warnings, []);

    const parsed = JSON.parse(plan.content ?? "{}") as {
      theme?: string;
      mcpServers?: Record<
        string,
        {
          command: string;
          args: string[];
          enabled: boolean;
          approval_mode?: string;
        }
      >;
    };
    assert.equal(parsed.theme, "dark");
    assert.deepEqual(parsed.mcpServers?.existing_server, {
      command: "custom-existing-server",
      args: ["serve"],
      enabled: true,
    });
    assert.deepEqual(parsed.mcpServers?.eslint, {
      command: "npx",
      args: ["@eslint/mcp@latest"],
      enabled: false,
    });
  });

  it("includes approval_mode when adding missing Claude MCP servers", () => {
    const plan = planClaudeCodeMcpSettingsSync(
      JSON.stringify({ mcpServers: {} }, null, 2),
      [
        {
          name: "eslint",
          command: "npx",
          args: ["@eslint/mcp@latest"],
          enabled: false,
          approval_mode: "never",
        },
      ],
    );

    const parsed = JSON.parse(plan.content ?? "{}") as {
      mcpServers?: Record<
        string,
        {
          command: string;
          args: string[];
          enabled: boolean;
          approval_mode?: string;
        }
      >;
    };

    assert.deepEqual(parsed.mcpServers?.eslint, {
      command: "npx",
      args: ["@eslint/mcp@latest"],
      enabled: false,
      approval_mode: "never",
    });
  });

  it('warns when Claude settings.json has a non-object "mcpServers" field', () => {
    const plan = planClaudeCodeMcpSettingsSync(
      JSON.stringify({ mcpServers: [] }),
      [
        {
          name: "eslint",
          command: "npx",
          args: ["@eslint/mcp@latest"],
          enabled: true,
        },
      ],
    );

    assert.equal(plan.content, undefined);
    assert.deepEqual(plan.added, []);
    assert.deepEqual(plan.unchanged, []);
    assert.match(plan.warnings[0] ?? "", /mcpServers/);
  });
});

describe("planCopilotMcpServersSync", () => {
  const desired = [
    { name: "omcp_state", command: "node", args: ["/abs/state-server.js"], timeoutMs: 5000 },
    { name: "omcp_memory", command: "node", args: ["/abs/memory-server.js"], timeoutMs: 5000 },
  ];

  it("adds OMCP servers to an empty mcp-config.json and sets the managed marker", () => {
    const plan = planCopilotMcpServersSync("", desired);
    assert.ok(plan.content);
    assert.deepEqual(plan.added.sort(), ["omcp_memory", "omcp_state"]);
    assert.deepEqual(plan.removed, []);
    const parsed = JSON.parse(plan.content!);
    assert.deepEqual(
      (parsed[COPILOT_MCP_MANAGED_MARKER] as string[]).sort(),
      ["omcp_memory", "omcp_state"],
    );
    assert.equal(parsed.mcpServers.omcp_state.type, "local");
    assert.equal(parsed.mcpServers.omcp_state.command, "node");
    assert.deepEqual(parsed.mcpServers.omcp_state.args, ["/abs/state-server.js"]);
    assert.equal(parsed.mcpServers.omcp_state.timeout, 5000);
  });

  it("preserves unrelated user-owned entries untouched", () => {
    const existing = JSON.stringify({
      mcpServers: {
        context7: { type: "http", url: "https://example.com" },
      },
    });
    const plan = planCopilotMcpServersSync(existing, desired);
    assert.ok(plan.content);
    const parsed = JSON.parse(plan.content!);
    assert.equal(parsed.mcpServers.context7.type, "http");
    assert.equal(parsed.mcpServers.context7.url, "https://example.com");
    assert.ok(parsed.mcpServers.omcp_state);
    assert.ok(parsed.mcpServers.omcp_memory);
  });

  it("re-run is idempotent (no content produced, all entries unchanged)", () => {
    const first = planCopilotMcpServersSync("", desired);
    const second = planCopilotMcpServersSync(first.content!, desired);
    assert.equal(second.content, undefined);
    assert.deepEqual(second.added, []);
    assert.deepEqual(second.updated, []);
    assert.deepEqual(second.removed, []);
    assert.deepEqual(second.unchanged.sort(), ["omcp_memory", "omcp_state"]);
  });

  it("updates a managed entry when its config changes", () => {
    const first = planCopilotMcpServersSync("", desired);
    const newDesired = [
      { ...desired[0], args: ["/new/state-server.js"] },
      desired[1],
    ];
    const second = planCopilotMcpServersSync(first.content!, newDesired);
    assert.ok(second.content);
    assert.deepEqual(second.updated, ["omcp_state"]);
    assert.deepEqual(second.added, []);
    const parsed = JSON.parse(second.content!);
    assert.deepEqual(parsed.mcpServers.omcp_state.args, ["/new/state-server.js"]);
  });

  it("removes managed entries that are no longer desired", () => {
    const first = planCopilotMcpServersSync("", desired);
    const second = planCopilotMcpServersSync(first.content!, [desired[0]]);
    assert.ok(second.content);
    assert.deepEqual(second.removed, ["omcp_memory"]);
    const parsed = JSON.parse(second.content!);
    assert.equal(parsed.mcpServers.omcp_memory, undefined);
    assert.deepEqual(parsed[COPILOT_MCP_MANAGED_MARKER], ["omcp_state"]);
  });

  it("refuses to clobber a user-owned entry with the same name", () => {
    const existing = JSON.stringify({
      mcpServers: {
        omcp_state: { type: "local", command: "/custom/path" },
      },
    });
    const plan = planCopilotMcpServersSync(existing, desired);
    assert.ok(plan.warnings.some((w) => w.includes("omcp_state")));
    // omcp_memory still gets added because it didn't collide
    assert.deepEqual(plan.added, ["omcp_memory"]);
  });

  it("shared-registry server conversion produces stdio/local entries", () => {
    const entry = sharedRegistryServerToCopilotEntry({
      name: "foo",
      command: "bar",
      args: ["--baz"],
      enabled: true,
      startupTimeoutSec: 7,
    });
    assert.equal(entry.name, "foo");
    assert.equal(entry.command, "bar");
    assert.deepEqual(entry.args, ["--baz"]);
    assert.equal(entry.timeoutMs, 7000);
  });
});

describe("planCopilotMcpServersRemoval", () => {
  it("removes managed entries while keeping user entries", () => {
    const existing = JSON.stringify({
      [COPILOT_MCP_MANAGED_MARKER]: ["omcp_state"],
      mcpServers: {
        omcp_state: { type: "local", command: "node", args: ["/a"] },
        context7: { type: "http", url: "https://example.com" },
      },
    });
    const plan = planCopilotMcpServersRemoval(existing);
    assert.ok(plan.content);
    assert.deepEqual(plan.removed, ["omcp_state"]);
    const parsed = JSON.parse(plan.content!);
    assert.equal(parsed[COPILOT_MCP_MANAGED_MARKER], undefined);
    assert.equal(parsed.mcpServers.omcp_state, undefined);
    assert.equal(parsed.mcpServers.context7.type, "http");
  });

  it("is a no-op when no managed marker is present", () => {
    const existing = JSON.stringify({
      mcpServers: { context7: { type: "http", url: "https://example.com" } },
    });
    const plan = planCopilotMcpServersRemoval(existing);
    assert.equal(plan.content, undefined);
    assert.deepEqual(plan.removed, []);
  });

  it("handles empty content", () => {
    const plan = planCopilotMcpServersRemoval("");
    assert.equal(plan.content, undefined);
    assert.deepEqual(plan.removed, []);
  });
});

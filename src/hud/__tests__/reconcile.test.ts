import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileHudForPromptSubmit } from '../reconcile.js';

describe('reconcileHudForPromptSubmit', () => {
  it('skips reconciliation outside tmux', async () => {
    const result = await reconcileHudForPromptSubmit('/tmp', {
      env: {},
    });
    assert.equal(result.status, 'skipped_not_tmux');
    assert.equal(result.paneId, null);
  });

  it('recreates a missing HUD in tmux', async () => {
    const created: Array<{ cwd: string; cmd: string; options?: { heightLines?: number; fullWidth?: boolean } }> = [];
    const resized: Array<{ paneId: string; heightLines: number }> = [];

    const result = await reconcileHudForPromptSubmit('/repo', {
      env: { TMUX: '1', TMUX_PANE: '%1' },
      listCurrentWindowPanes: () => [
        { paneId: '%1', currentCommand: 'copilot', startCommand: 'copilot' },
      ],
      createHudWatchPane: (cwd, cmd, options) => {
        created.push({ cwd, cmd, options });
        return '%9';
      },
      resizeTmuxPane: (paneId, heightLines) => {
        resized.push({ paneId, heightLines });
        return true;
      },
      resolveOmcpCliEntryPath: () => '/repo/dist/cli/omcp.js',
    });

    assert.equal(result.status, 'recreated');
    assert.equal(result.paneId, '%9');
    assert.equal(created.length, 1);
    assert.match(created[0]?.cmd || '', /\/repo\/dist\/cli\/omcp\.js' hud --watch/);
    assert.equal(created[0]?.options?.heightLines, 3);
    assert.equal(resized.length, 1);
    assert.equal(resized[0]?.heightLines, 3);
  });

  it('prefers an explicit session override when recreating HUD', async () => {
    const created: Array<{ cmd: string }> = [];

    const result = await reconcileHudForPromptSubmit('/repo', {
      env: { TMUX: '1', TMUX_PANE: '%1', OMCP_SESSION_ID: 'sess-stale' },
      sessionId: 'sess-canonical',
      listCurrentWindowPanes: () => [
        { paneId: '%1', currentCommand: 'copilot', startCommand: 'copilot' },
      ],
      createHudWatchPane: (_cwd, cmd) => {
        created.push({ cmd });
        return '%9';
      },
      resizeTmuxPane: () => true,
      resolveOmcpCliEntryPath: () => '/repo/dist/cli/omcp.js',
    });

    assert.equal(result.status, 'recreated');
    assert.equal(created.length, 1);
    assert.match(created[0]?.cmd || '', /^OMCP_SESSION_ID='sess-canonical' node '.*omcp\.js' hud --watch/);
    assert.doesNotMatch(created[0]?.cmd || '', /sess-stale/);
  });

  it('kills duplicate HUD panes and recreates one full-width pane', async () => {
    const killed: string[] = [];

    const result = await reconcileHudForPromptSubmit('/repo', {
      env: { TMUX: '1', TMUX_PANE: '%1' },
      listCurrentWindowPanes: () => [
        { paneId: '%1', currentCommand: 'copilot', startCommand: 'copilot' },
        { paneId: '%2', currentCommand: 'node', startCommand: 'node omcp hud --watch' },
        { paneId: '%3', currentCommand: 'node', startCommand: 'node omcp hud --watch' },
        { paneId: '%4', currentCommand: 'copilot', startCommand: 'copilot' },
      ],
      killTmuxPane: (paneId) => {
        killed.push(paneId);
        return true;
      },
      createHudWatchPane: (_cwd, _cmd, options) => {
        assert.equal(options?.fullWidth, true);
        assert.equal(options?.heightLines, 3);
        return '%9';
      },
      resizeTmuxPane: () => true,
      resolveOmcpCliEntryPath: () => '/repo/dist/cli/omcp.js',
    });

    assert.equal(result.status, 'replaced_duplicates');
    assert.deepEqual(killed, ['%2', '%3']);
  });

  it('resizes an existing single HUD pane instead of recreating it', async () => {
    const resized: Array<{ paneId: string; heightLines: number }> = [];
    const result = await reconcileHudForPromptSubmit('/repo', {
      env: { TMUX: '1', TMUX_PANE: '%1' },
      listCurrentWindowPanes: () => [
        { paneId: '%1', currentCommand: 'copilot', startCommand: 'copilot' },
        { paneId: '%2', currentCommand: 'node', startCommand: 'node omcp hud --watch' },
      ],
      resizeTmuxPane: (paneId, heightLines) => {
        resized.push({ paneId, heightLines });
        return true;
      },
      resolveOmcpCliEntryPath: () => '/repo/dist/cli/omcp.js',
    });

    assert.equal(result.status, 'resized');
    assert.equal(resized.length, 1);
    assert.equal(resized[0]?.paneId, '%2');
    assert.equal(resized[0]?.heightLines, 3);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addGeneratedAgentsMarker,
  hasOmcpManagedAgentsSections,
  isOmcpGeneratedAgentsMd,
  OMCP_GENERATED_AGENTS_MARKER,
} from '../agents-md.js';

describe('agents-md helpers', () => {
  it('inserts the generated marker after the autonomy directive block', () => {
    const content = [
      '<!-- AUTONOMY DIRECTIVE — DO NOT REMOVE -->',
      'YOU ARE AN AUTONOMOUS CODING AGENT. EXECUTE TASKS TO COMPLETION WITHOUT ASKING FOR PERMISSION.',
      'DO NOT STOP TO ASK "SHOULD I PROCEED?" — PROCEED. DO NOT WAIT FOR CONFIRMATION ON OBVIOUS NEXT STEPS.',
      'IF BLOCKED, TRY AN ALTERNATIVE APPROACH. ONLY ASK WHEN TRULY AMBIGUOUS OR DESTRUCTIVE.',
      '<!-- END AUTONOMY DIRECTIVE -->',
      '# oh-my-copilot - Intelligent Multi-Agent Orchestration',
    ].join('\n');

    const result = addGeneratedAgentsMarker(content);

    assert.match(
      result,
      /<!-- END AUTONOMY DIRECTIVE -->\n<!-- omcp:generated:agents-md -->\n# oh-my-copilot - Intelligent Multi-Agent Orchestration/,
    );
  });

  it('does not duplicate an existing generated marker', () => {
    const content = `header\n${OMCP_GENERATED_AGENTS_MARKER}\nbody\n`;
    assert.equal(addGeneratedAgentsMarker(content), content);
  });

  it('treats autonomy-directive generated files as OMCP-managed once marked', () => {
    const content = [
      '<!-- AUTONOMY DIRECTIVE — DO NOT REMOVE -->',
      'directive body',
      '<!-- END AUTONOMY DIRECTIVE -->',
      OMCP_GENERATED_AGENTS_MARKER,
      '# oh-my-copilot - Intelligent Multi-Agent Orchestration',
    ].join('\n');

    assert.equal(isOmcpGeneratedAgentsMd(content), true);
  });

  it('does not treat title-only user AGENTS.md content as OMCP-generated', () => {
    const content = [
      '# oh-my-copilot - Intelligent Multi-Agent Orchestration',
      '',
      'User-authored guidance without any OMCP ownership markers.',
    ].join('\n');

    assert.equal(isOmcpGeneratedAgentsMd(content), false);
    assert.equal(hasOmcpManagedAgentsSections(content), false);
  });

  it('recognizes explicit OMCP-owned model table blocks as managed sections', () => {
    const content = [
      '# Shared ownership AGENTS',
      '',
      '<!-- OMCP:MODELS:START -->',
      'managed table',
      '<!-- OMCP:MODELS:END -->',
    ].join('\n');

    assert.equal(isOmcpGeneratedAgentsMd(content), false);
    assert.equal(hasOmcpManagedAgentsSections(content), true);
  });
});

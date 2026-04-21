import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectInheritableTeamWorkerArgs,
  isLowComplexityAgentType,
  resolveAgentDefaultModel,
  resolveAgentReasoningEffort,
  resolveTeamWorkerLaunchArgs,
  TEAM_LOW_COMPLEXITY_DEFAULT_MODEL,
  resolveTeamLowComplexityDefaultModel,
} from '../model-contract.js';

function expectedLowComplexityModel(): string {
  return resolveTeamLowComplexityDefaultModel();
}

describe('team model contract', () => {
  it('collects inheritable bypass, reasoning, and model overrides', () => {
    assert.deepEqual(
      collectInheritableTeamWorkerArgs([
        '--allow-all-tools',
        '-c',
        'model_reasoning_effort="xhigh"',
        '--model=gpt-5.3',
      ]),
      [
        '--allow-all-tools',
        '--reasoning-effort',
        'xhigh',
        '--model',
        'gpt-5.3',
      ],
    );
  });

  it('keeps exactly one canonical model flag with precedence env > inherited > fallback', () => {
    assert.deepEqual(
      resolveTeamWorkerLaunchArgs({
        existingRaw: '--model env-a --model=env-b',
        inheritedArgs: ['--model', 'inherited-model'],
        fallbackModel: expectedLowComplexityModel(),
      }),
      ['--model', 'env-b'],
    );
  });

  it('uses inherited model when env model is absent', () => {
    assert.deepEqual(
      resolveTeamWorkerLaunchArgs({
        existingRaw: '--no-alt-screen',
        inheritedArgs: ['--model=inherited-model'],
      }),
      ['--no-alt-screen', '--model', 'inherited-model'],
    );
  });

  it('uses fallback model when env and inherited models are absent', () => {
    assert.deepEqual(
      resolveTeamWorkerLaunchArgs({
        existingRaw: '--no-alt-screen',
        inheritedArgs: ['--allow-all-tools'],
        fallbackModel: expectedLowComplexityModel(),
      }),
      ['--no-alt-screen', '--allow-all-tools', '--model', expectedLowComplexityModel()],
    );
  });

  it('drops orphan --model flag and emits exactly one canonical --model', () => {
    // Orphan --model with no following value must not leak into passthrough and cause duplicate flags
    assert.deepEqual(
      resolveTeamWorkerLaunchArgs({
        existingRaw: '--model',
        inheritedArgs: ['--model', 'inherited-model'],
      }),
      ['--model', 'inherited-model'],
    );
  });

  it('drops orphan --model mixed with other flags and does not emit duplicate flags', () => {
    assert.deepEqual(
      resolveTeamWorkerLaunchArgs({
        existingRaw: '--no-alt-screen --model',
        inheritedArgs: ['--model', 'sonic-model'],
      }),
      ['--no-alt-screen', '--model', 'sonic-model'],
    );
  });

  it('drops --model= with empty value and falls back to inherited model', () => {
    assert.deepEqual(
      resolveTeamWorkerLaunchArgs({
        existingRaw: '--model=',
        inheritedArgs: ['--model', 'inherited-model'],
      }),
      ['--model', 'inherited-model'],
    );
  });

  it('detects low-complexity agent types', () => {
    assert.equal(isLowComplexityAgentType('explore'), true);
    assert.equal(isLowComplexityAgentType('writer'), false);
    assert.equal(isLowComplexityAgentType('style-reviewer'), true);
    assert.equal(isLowComplexityAgentType('executor'), false);
    assert.equal(isLowComplexityAgentType('executor-low'), true);
  });

  it('maps worker roles to default reasoning effort tiers', () => {
    assert.equal(resolveAgentReasoningEffort('explore'), 'low');
    assert.equal(resolveAgentReasoningEffort('executor'), 'high');
    assert.equal(resolveAgentReasoningEffort('architect'), 'high');
    assert.equal(resolveAgentReasoningEffort('does-not-exist'), undefined);
  });

  it('maps worker roles to explicit default model lanes', () => {
    assert.equal(resolveAgentDefaultModel('explore'), expectedLowComplexityModel());
    assert.equal(resolveAgentDefaultModel('writer'), 'gpt-5.4-mini');
    assert.equal(resolveAgentDefaultModel('executor'), 'gpt-5.4');
    assert.equal(resolveAgentDefaultModel('architect'), 'gpt-5.4');
    assert.equal(resolveAgentDefaultModel('does-not-exist'), undefined);
  });

  it('keeps assigned worker roles as their own runtime identity', () => {
    assert.equal(resolveAgentDefaultModel('explore'), expectedLowComplexityModel());
    assert.equal(resolveAgentReasoningEffort('explore'), 'low');
    assert.equal(resolveAgentDefaultModel('style-reviewer'), expectedLowComplexityModel());
    assert.equal(resolveAgentReasoningEffort('style-reviewer'), 'low');
  });
});

describe('resolveTeamWorkerLaunchArgs - teammate reasoning allocation', () => {
  it('injects preferred reasoning when explicit reasoning is absent', () => {
    const result = resolveTeamWorkerLaunchArgs({
      fallbackModel: expectedLowComplexityModel(),
      preferredReasoning: 'low',
    });
    assert.deepEqual(
      result,
      ['--reasoning-effort', 'low', '--model', expectedLowComplexityModel()],
    );
  });

  it('does not auto-inject thinking level for fallback model when no preference is provided', () => {
    const result = resolveTeamWorkerLaunchArgs({
      fallbackModel: expectedLowComplexityModel(),
    });
    const joined = result.join(' ');
    assert.ok(!joined.includes('reasoning-effort'), `Expected no auto-injected thinking level in: ${joined}`);
    assert.ok(!joined.includes('model_reasoning_effort'), `Expected no legacy codex reasoning key in: ${joined}`);
  });

  it('preserves explicit reasoning override over teammate preference', () => {
    const result = resolveTeamWorkerLaunchArgs({
      existingRaw: '-c model_reasoning_effort="high"',
      fallbackModel: expectedLowComplexityModel(),
      preferredReasoning: 'low',
    });
    const joined = result.join(' ');
    // Must emit the copilot-native form with the explicit high level.
    assert.ok(/--reasoning-effort\s+high/.test(joined), `Expected explicit high level in: ${joined}`);
    // Should appear exactly once and never leak the legacy codex -c form.
    const copilotMatches = joined.match(/--reasoning-effort/g) ?? [];
    assert.equal(copilotMatches.length, 1, 'reasoning override should appear exactly once');
    assert.ok(!joined.includes('model_reasoning_effort'), 'legacy codex config key must not appear');
  });

  it('does not inject thinking when model is explicit but reasoning is omitted', () => {
    const result = resolveTeamWorkerLaunchArgs({
      existingRaw: '--model claude-opus-4',
    });
    const joined = result.join(' ');
    assert.ok(!joined.includes('reasoning-effort'), `Expected no reasoning in: ${joined}`);
    assert.ok(!joined.includes('model_reasoning_effort'), `Expected no legacy reasoning in: ${joined}`);
  });
});

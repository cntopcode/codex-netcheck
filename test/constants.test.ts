import { describe, expect, it } from 'vitest';
import { connectionTargets, diagnosticHosts, httpsTargets } from '../src/constants.js';
import type { RunOptions } from '../src/types.js';

function options(includeClaude: boolean): RunOptions {
  return {
    timeoutMs: 8_000,
    includeSensitive: false,
    includeClaude,
    language: 'zh',
  };
}

describe('诊断目标选择', () => {
  it('默认只检查 OpenAI/Codex', () => {
    expect(diagnosticHosts(options(false))).toEqual(['api.openai.com', 'chatgpt.com']);
    expect(connectionTargets(options(false)).map((target) => target.host)).toEqual([
      'api.openai.com',
    ]);
    expect(httpsTargets(options(false)).every((target) => target.provider === 'openai')).toBe(true);
  });

  it('启用 Claude 后追加 Anthropic 目标', () => {
    expect(diagnosticHosts(options(true))).toContain('api.anthropic.com');
    expect(diagnosticHosts(options(true))).toContain('claude.ai');
    expect(connectionTargets(options(true)).map((target) => target.host)).toContain(
      'api.anthropic.com',
    );
    expect(httpsTargets(options(true)).map((target) => target.id)).toEqual(
      expect.arrayContaining(['https-claude-api', 'https-claude-web']),
    );
  });
});

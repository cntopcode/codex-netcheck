import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/reporters/markdown.js';
import type { DiagnosticReport } from '../src/types.js';

const report: DiagnosticReport = {
  schemaVersion: 1,
  tool: { name: 'codex-netcheck', version: '0.1.0' },
  generatedAt: '2026-08-12T00:00:00.000Z',
  durationMs: 123,
  platform: { os: 'darwin', release: '26.5', architecture: 'arm64', node: 'v22' },
  summary: { status: 'pass', passed: 1, warnings: 0, failed: 0, skipped: 0, conclusion: '正常' },
  results: [
    {
      id: 'dns-test',
      category: 'dns',
      name: 'DNS',
      status: 'pass',
      summary: '解析成功',
      latencyMs: 12,
    },
  ],
};

describe('renderMarkdown', () => {
  it('生成中文表头和结论', () => {
    const output = renderMarkdown(report);
    expect(output).toContain('# OpenAI/Codex 网络诊断报告');
    expect(output).toContain('| 检查项 | 状态 | 延迟（ms） | 说明 |');
    expect(output).toContain('| DNS | 通过 | 12 | 解析成功 |');
  });

  it('Claude 检查使用联合报告标题', () => {
    const claudeReport: DiagnosticReport = {
      ...report,
      results: [
        {
          id: 'https-claude-api',
          category: 'https',
          name: 'Claude API HTTPS',
          status: 'pass',
          summary: '服务可达',
        },
      ],
    };

    expect(renderMarkdown(claudeReport)).toContain('# OpenAI/Codex + Claude 网络诊断报告');
  });
});

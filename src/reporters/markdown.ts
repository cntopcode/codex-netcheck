import type { DiagnosticReport } from '../types.js';

const labels = { pass: '通过', warn: '警告', fail: '失败', skip: '跳过' } as const;

export function renderMarkdown(report: DiagnosticReport): string {
  const rows = report.results.map((result) => {
    const summary = result.summary.replaceAll('|', '\\|').replaceAll('\n', ' ');
    return `| ${result.name} | ${labels[result.status]} | ${result.latencyMs ?? '—'} | ${summary} |`;
  });
  const recommendations = report.results
    .filter((result) => result.remediation)
    .map((result) => `- **${result.name}**：${result.remediation}`);

  return [
    '# OpenAI/Codex 网络诊断报告',
    '',
    `- 生成时间：${report.generatedAt}`,
    `- 平台：${report.platform.os} ${report.platform.release} (${report.platform.architecture})`,
    `- 工具版本：${report.tool.version}`,
    `- 总耗时：${report.durationMs} ms`,
    '',
    '## 结论',
    '',
    report.summary.conclusion,
    '',
    '## 检查结果',
    '',
    '| 检查项 | 状态 | 延迟（ms） | 说明 |',
    '|---|---|---:|---|',
    ...rows,
    ...(recommendations.length > 0 ? ['', '## 建议', '', ...recommendations] : []),
    '',
    '> 报告由 codex-netcheck 生成；默认已对 Token、代理凭据和用户目录进行脱敏。',
    '',
  ].join('\n');
}

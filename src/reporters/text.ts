import chalk from 'chalk';
import type { CheckResult, CheckStatus, DiagnosticReport } from '../types.js';

const icons: Record<CheckStatus, string> = {
  pass: '✓',
  warn: '!',
  fail: '✗',
  skip: '–',
};

function colorStatus(status: CheckStatus, value: string): string {
  if (status === 'pass') return chalk.green(value);
  if (status === 'warn') return chalk.yellow(value);
  if (status === 'fail') return chalk.red(value);
  return chalk.gray(value);
}

function renderResult(result: CheckResult): string {
  const latency = result.latencyMs === undefined ? '' : chalk.dim(` ${result.latencyMs} ms`);
  const target = result.target ? chalk.dim(` (${result.target})`) : '';
  const first = `${colorStatus(result.status, icons[result.status])} ${chalk.bold(result.name)}${target}: ${result.summary}${latency}`;
  const remediation = result.remediation ? `\n  ${chalk.cyan('建议：')} ${result.remediation}` : '';
  return first + remediation;
}

export function renderText(report: DiagnosticReport, color = true): string {
  if (!color) chalk.level = 0;
  const heading = chalk.bold.cyan('codex-netcheck · OpenAI/Codex 网络诊断');
  const lines = report.results.map(renderResult);
  const summary = [
    '',
    chalk.bold('综合结论'),
    colorStatus(report.summary.status, report.summary.conclusion),
    chalk.dim(
      `通过 ${report.summary.passed} · 警告 ${report.summary.warnings} · 失败 ${report.summary.failed} · 跳过 ${report.summary.skipped} · ${report.durationMs} ms`,
    ),
  ];
  return [heading, '', ...lines, ...summary].join('\n');
}

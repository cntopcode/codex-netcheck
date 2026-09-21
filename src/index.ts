import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { checkDns } from './checks/dns.js';
import { checkEnvironment } from './checks/environment.js';
import { checkHttps } from './checks/https.js';
import { checkProxy } from './checks/proxy.js';
import { checkRoute } from './checks/route.js';
import { checkTcp } from './checks/tcp.js';
import { checkTls } from './checks/tls.js';
import { checkWebSocket } from './checks/websocket.js';
import { VERSION } from './constants.js';
import { redactValue } from './redact.js';
import type { CheckResult, CheckStatus, DiagnosticReport, Probe, ProbeContext, RunOptions } from './types.js';

export type { CheckResult, CheckStatus, DiagnosticReport, RunOptions } from './types.js';
export { renderMarkdown } from './reporters/markdown.js';
export { renderText } from './reporters/text.js';

const DEFAULT_OPTIONS: RunOptions = {
  timeoutMs: 8_000,
  includeSensitive: false,
  includeClaude: false,
  language: 'zh',
};

const probes: Probe[] = [
  checkEnvironment,
  checkProxy,
  checkDns,
  checkRoute,
  checkTcp,
  checkTls,
  checkHttps,
  checkWebSocket,
];

function deriveSummary(results: CheckResult[], includeClaude: boolean): DiagnosticReport['summary'] {
  const passed = results.filter((result) => result.status === 'pass').length;
  const warnings = results.filter((result) => result.status === 'warn').length;
  const failed = results.filter((result) => result.status === 'fail').length;
  const skipped = results.filter((result) => result.status === 'skip').length;
  let status: CheckStatus = 'pass';
  let conclusion = includeClaude
    ? '所选路径上的 OpenAI 与 Claude 网络探针通过；未验证账号权限或实际模型请求。'
    : '所选路径上的 OpenAI 网络探针通过；未验证 Codex 账号权限或实际模型请求。';

  if (failed > 0) {
    status = 'fail';
    const categories = [...new Set(results.filter((result) => result.status === 'fail').map((result) => result.category))];
    conclusion = `检测到 ${failed} 项失败，优先排查：${categories.join('、')}。`;
  } else if (warnings > 0) {
    status = 'warn';
    conclusion = '检查完成，有警告项，请按各项说明判断；可用 --direct 对比直连/TUN 路径。';
  }

  return { status, passed, warnings, failed, skipped, conclusion };
}

export async function runDiagnostics(input: Partial<RunOptions> = {}): Promise<DiagnosticReport> {
  const options = { ...DEFAULT_OPTIONS, ...input };
  const context: ProbeContext = { options, dnsAddresses: new Map() };
  const results: CheckResult[] = [];
  const startedAt = performance.now();

  // DNS 必须先于路由检查，其他探针按顺序执行以避免瞬时并发影响延迟读数。
  for (const probe of probes) {
    const output = await probe(context);
    results.push(...(Array.isArray(output) ? output : [output]));
  }

  const report: DiagnosticReport = {
    schemaVersion: 1,
    tool: { name: 'codex-netcheck', version: VERSION },
    generatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startedAt),
    platform: {
      os: os.platform(),
      release: os.release(),
      architecture: os.arch(),
      node: process.version,
    },
    summary: deriveSummary(results, options.includeClaude ?? false),
    results,
  };

  return redactValue(report, options.includeSensitive) as DiagnosticReport;
}

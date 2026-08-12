#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { Command, Option } from 'commander';
import { runDiagnostics } from './index.js';
import { renderMarkdown } from './reporters/markdown.js';
import { renderText } from './reporters/text.js';

interface CliOptions {
  json?: boolean;
  report?: string;
  timeout: string;
  watch?: string;
  color: boolean;
  includeSensitive?: boolean;
}

const program = new Command()
  .name('codex-netcheck')
  .description('诊断影响 OpenAI 和 Codex 的 DNS、TLS、HTTPS、WebSocket、代理及路由问题')
  .version('0.1.0')
  .option('--json', '以 JSON 输出')
  .option('--report <path>', '另存为 Markdown 或 JSON 报告')
  .option('--timeout <seconds>', '单项检查超时秒数', '8')
  .option('--watch <seconds>', '持续检查，并按指定秒数重复')
  .option('--no-color', '禁用彩色输出')
  .addOption(
    new Option('--include-sensitive', '报告保留敏感信息（不推荐）').hideHelp(),
  )
  .showHelpAfterError();

program.parse();
const options = program.opts<CliOptions>();

function positiveNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是大于 0 的数字`);
  }
  return parsed;
}

async function writeReport(path: string, report: Awaited<ReturnType<typeof runDiagnostics>>) {
  const content = path.toLowerCase().endsWith('.json')
    ? `${JSON.stringify(report, null, 2)}\n`
    : renderMarkdown(report);
  await writeFile(path, content, { encoding: 'utf8', mode: 0o600 });
}

async function runOnce() {
  const timeoutMs = positiveNumber(options.timeout, '--timeout') * 1_000;
  const report = await runDiagnostics({
    timeoutMs,
    includeSensitive: options.includeSensitive ?? false,
    language: 'zh',
  });
  const output = options.json
    ? JSON.stringify(report, null, 2)
    : renderText(report, options.color);
  process.stdout.write(`${output}\n`);

  if (options.report) {
    await writeReport(options.report, report);
    process.stderr.write(`报告已保存：${options.report}\n`);
  }
  return report.summary.failed > 0 ? 1 : 0;
}

async function main() {
  if (!options.watch) {
    process.exitCode = await runOnce();
    return;
  }

  const intervalMs = positiveNumber(options.watch, '--watch') * 1_000;
  let runNumber = 0;
  while (true) {
    runNumber += 1;
    if (runNumber > 1) process.stdout.write('\n');
    process.stdout.write(`第 ${runNumber} 次检查 · ${new Date().toLocaleString()}\n`);
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`codex-netcheck 运行失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});

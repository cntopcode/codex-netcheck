import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import type { CheckResult, Probe } from '../types.js';
import { redactString } from '../redact.js';

const execFileAsync = promisify(execFile);

const PROXY_VARIABLES = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
] as const;

async function macOsProxyDetails(): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await execFileAsync('scutil', ['--proxy'], { timeout: 3_000 });
    const selected = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^(HTTP|HTTPS|SOCKS|ProxyAutoConfig|ExceptionsList)/.test(line));
    return { system: selected };
  } catch {
    return {};
  }
}

export const checkProxy: Probe = async (context) => {
  const environment = Object.fromEntries(
    PROXY_VARIABLES.flatMap((key) => {
      const value = process.env[key];
      return value ? [[key, redactString(value, context.options.includeSensitive)]] : [];
    }),
  );
  const system = os.platform() === 'darwin' ? await macOsProxyDetails() : {};
  const hasEnvironmentProxy = Object.keys(environment).some((key) => !key.toLowerCase().includes('no_proxy'));
  const hasSystemProxy = JSON.stringify(system).includes('Enable : 1');
  const status = hasEnvironmentProxy || hasSystemProxy ? 'warn' : 'pass';

  return {
    id: 'proxy',
    category: 'proxy',
    name: '代理设置',
    status,
    summary:
      status === 'warn'
        ? '检测到代理配置；网络结果会受到代理节点和分流规则影响'
        : '未检测到环境变量或 macOS 系统代理',
    details: { environment, ...system },
    remediation:
      status === 'warn'
        ? '若结果异常，对比关闭代理后的结果，并确认 OpenAI 域名与 WebSocket 分流规则。'
        : undefined,
  } satisfies CheckResult;
};

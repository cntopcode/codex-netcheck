import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import type { ProbeContext, RunOptions } from './types.js';
import { redactString } from './redact.js';

export interface ProxyRoute { url?: string; source: string }
export interface ProxyPolicy { route: ProxyRoute; bypass: string[]; warning?: string }

export function parseSystemProxy(output: string): { url?: string; bypass: string[]; pac: boolean } {
  const value = (key: string) => output.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'm'))?.[1]?.trim();
  const exceptions = output.match(/ExceptionsList\s*:\s*<array>\s*\{([^}]+)\}/)?.[1] ?? '';
  const bypass = [...exceptions.matchAll(/\d+\s*:\s*(\S+)/g)].map((match) => match[1]!);
  for (const kind of ['HTTPS', 'SOCKS']) {
    if (value(`${kind}Enable`) !== '1') continue;
    const host = value(`${kind}Proxy`);
    const port = value(`${kind}Port`);
    if (!host || !port) continue;
    const address = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    return { url: `${kind === 'SOCKS' ? 'socks5h' : 'http'}://${address}:${port}`, bypass, pac: false };
  }
  return { bypass, pac: value('ProxyAutoConfigEnable') === '1' || value('ProxyAutoDiscoveryEnable') === '1' };
}

function validateProxy(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('代理地址无效，请使用 http://host:port 或 socks5h://host:port'); }
  if (!['http:', 'https:', 'socks:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:'].includes(url.protocol)) {
    throw new Error('不支持该代理协议；支持 HTTP、HTTPS 和 SOCKS');
  }
  if (!url.hostname || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error('代理地址只能包含协议、凭据、主机和端口');
  }
  return url.href;
}

export function resolveProxyPolicy(options: Partial<RunOptions>, env: NodeJS.ProcessEnv, system = ''): ProxyPolicy {
  if (options.direct && options.proxy) throw new Error('--direct 与 --proxy 不能同时使用');
  if (options.direct) return { route: { source: '显式直连（仍可能经过系统 TUN）' }, bypass: [] };
  if (options.proxy) return { route: { url: validateProxy(options.proxy), source: '--proxy' }, bypass: [] };
  const bypass = (env.no_proxy ?? env.NO_PROXY ?? '').split(/[\s,]+/).filter(Boolean);
  for (const key of ['https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY']) {
    if (env[key]) return { route: { url: validateProxy(env[key]), source: key }, bypass };
  }
  const parsed = parseSystemProxy(system);
  return {
    route: { url: parsed.url ? validateProxy(parsed.url) : undefined, source: parsed.url ? 'macOS 系统代理' : '直连（未检测到 HTTPS/ALL_PROXY 或系统代理）' },
    bypass: [...bypass, ...parsed.bypass],
    warning: parsed.pac ? '检测到 PAC/自动发现代理，暂不自动执行 PAC；请用 --proxy 指定实际代理地址。' : undefined,
  };
}

export async function discoverProxyPolicy(options: RunOptions): Promise<ProxyPolicy> {
  let system = '';
  let warning: string | undefined;
  if (os.platform() === 'darwin' && !options.direct && !options.proxy &&
      !['https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY'].some((key) => process.env[key])) {
    try { system = (await promisify(execFile)('scutil', ['--proxy'], { timeout: 3_000 })).stdout; }
    catch { warning = '无法读取 macOS 系统代理，当前按直连检测；可用 --proxy 显式指定。'; }
  }
  const policy = resolveProxyPolicy(options, process.env, system);
  if (warning) policy.warning = warning;
  return policy;
}

export function selectRoute(policy: ProxyPolicy | undefined, target: string): ProxyRoute {
  if (!policy) return { source: '直连' };
  const url = new URL(target);
  const hostname = url.hostname.toLowerCase();
  const port = url.port || '443';
  for (const raw of policy.bypass) {
    const rule = raw.toLowerCase();
    if (rule === '*') return { source: '代理例外（NO_PROXY/系统设置）' };
    const match = rule.match(/^(.*):(\d+)$/);
    if (match && match[2] !== port) continue;
    const host = match ? match[1]! : rule;
    if (host === hostname || ((host.startsWith('.') || host.startsWith('*.')) && hostname.endsWith(host.replace(/^\*/, '')))) {
      return { source: '代理例外（NO_PROXY/系统设置）' };
    }
  }
  return policy.route;
}

export function routeFor(context: ProbeContext, target: string): ProxyRoute {
  return selectRoute(context.proxyPolicy, target);
}
export function describeRoute(route: ProxyRoute): string {
  return route.url ? `${route.source} ${redactString(route.url)}` : route.source;
}
export function proxyResolvesDns(route: ProxyRoute): boolean {
  return !!route.url && !['socks4:', 'socks5:'].includes(new URL(route.url).protocol);
}
export function createProxyAgent(route: ProxyRoute, timeoutMs: number, signal?: AbortSignal) {
  if (!route.url) return undefined;
  return route.url.startsWith('socks')
    ? new SocksProxyAgent(route.url, { timeout: timeoutMs, socketOptions: { signal } })
    : new HttpsProxyAgent(route.url, { timeout: timeoutMs, signal });
}

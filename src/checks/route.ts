import { routeFor, describeRoute } from '../proxy.js';
import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { connectionTargets } from '../constants.js';
import type { CheckResult, Probe } from '../types.js';

const execFileAsync = promisify(execFile);

export const checkRoute: Probe = async (context) => {
  const results: CheckResult[] = [];

  for (const target of connectionTargets(context.options)) {
    const route = routeFor(context, `https://${target.host}`);
    if (route.url) {
      results.push({ id: `route-${target.id}`, category: 'route', name: `${target.name} 网络路由`,
        target: target.host, status: 'pass', summary: `经 ${describeRoute(route)}；目标路由由代理选择`,
        details: { path: describeRoute(route) } });
      continue;
    }
    const address = context.dnsAddresses.get(target.host)?.[0];
    if (!address) {
      results.push({
        id: `route-${target.id}`,
        category: 'route',
        name: `${target.name} 网络路由`,
        target: target.host,
        status: 'skip',
        summary: 'DNS 未得到地址，跳过路由检查',
      });
      continue;
    }

    try {
      let command: string;
      let args: string[];
      if (os.platform() === 'darwin') {
        command = 'route';
        args = ['-n', 'get', address];
      } else if (os.platform() === 'linux') {
        command = 'ip';
        args = ['route', 'get', address];
      } else {
        results.push({
          id: `route-${target.id}`,
          category: 'route',
          name: `${target.name} 网络路由`,
          target: address,
          status: 'skip',
          summary: `暂不支持 ${os.platform()} 的路由读取`,
        });
        continue;
      }

      const { stdout } = await execFileAsync(command, args, { timeout: 3_000 });
      const interfaceMatch =
        os.platform() === 'darwin'
          ? stdout.match(/interface:\s+(\S+)/)
          : stdout.match(/\bdev\s+(\S+)/);
      const gatewayMatch =
        os.platform() === 'darwin'
          ? stdout.match(/gateway:\s+(\S+)/)
          : stdout.match(/\bvia\s+(\S+)/);
      const networkInterface = interfaceMatch?.[1] ?? 'unknown';
      const isTunnel = /^(utun|tun|tap|wg)/i.test(networkInterface);

      results.push({
        id: `route-${target.id}`,
        category: 'route',
        name: `${target.name} 网络路由`,
        target: address,
        status: isTunnel ? 'warn' : 'pass',
        summary: isTunnel ? `流量经过隧道接口 ${networkInterface}` : `出口接口 ${networkInterface}`,
        details: {
          address,
          interface: networkInterface,
          gateway: gatewayMatch?.[1],
          tunnel: isTunnel,
        },
        remediation: isTunnel ? '这是代理/VPN 常见状态；异常时应检查该隧道的节点与分流规则。' : undefined,
      });
    } catch (error) {
      results.push({
        id: `route-${target.id}`,
        category: 'route',
        name: `${target.name} 网络路由`,
        target: address,
        status: 'warn',
        summary: `无法读取路由：${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return results;
};

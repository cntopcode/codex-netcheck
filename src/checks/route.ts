import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import type { Probe } from '../types.js';

const execFileAsync = promisify(execFile);

export const checkRoute: Probe = async (context) => {
  const host = 'api.openai.com';
  const address = context.dnsAddresses.get(host)?.[0];
  if (!address) {
    return {
      id: 'route-api',
      category: 'route',
      name: '网络路由',
      target: host,
      status: 'skip',
      summary: 'DNS 未得到地址，跳过路由检查',
    };
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
      return {
        id: 'route-api',
        category: 'route',
        name: '网络路由',
        target: address,
        status: 'skip',
        summary: `暂不支持 ${os.platform()} 的路由读取`,
      };
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

    return {
      id: 'route-api',
      category: 'route',
      name: '网络路由',
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
    };
  } catch (error) {
    return {
      id: 'route-api',
      category: 'route',
      name: '网络路由',
      target: address,
      status: 'warn',
      summary: `无法读取路由：${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

import net from 'node:net';
import { connectionTargets } from '../constants.js';
import type { CheckResult, Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

export const checkTcp: Probe = async (context) => {
  const port = 443;
  const results: CheckResult[] = [];

  for (const target of connectionTargets(context.options)) {
    try {
      const { latencyMs } = await measure(
        () =>
          new Promise<void>((resolve, reject) => {
            const socket = net.createConnection({ host: target.host, port });
            const timer = setTimeout(
              () => socket.destroy(new Error('TCP connection timeout')),
              context.options.timeoutMs,
            );
            socket.once('connect', () => {
              clearTimeout(timer);
              socket.end();
              resolve();
            });
            socket.once('error', (error) => {
              clearTimeout(timer);
              reject(error);
            });
          }),
      );

      results.push({
        id: `tcp-${target.id}`,
        category: 'tcp',
        name: `${target.name} TCP 连接`,
        target: `${target.host}:${port}`,
        status: 'pass',
        summary: '443 端口连接成功',
        latencyMs,
      });
    } catch (error) {
      const details = errorDetails(error);
      results.push({
        id: `tcp-${target.id}`,
        category: 'tcp',
        name: `${target.name} TCP 连接`,
        target: `${target.host}:${port}`,
        status: 'fail',
        summary: `连接失败：${details.message}`,
        errorCode: details.code,
        remediation: `检查防火墙、VPN 节点、系统代理和到 ${target.host}:443 的路由。`,
      });
    }
  }

  return results;
};

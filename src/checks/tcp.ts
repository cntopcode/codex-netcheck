import net from 'node:net';
import type { Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

export const checkTcp: Probe = async (context) => {
  const host = 'api.openai.com';
  const port = 443;

  try {
    const { latencyMs } = await measure(
      () =>
        new Promise<void>((resolve, reject) => {
          const socket = net.createConnection({ host, port });
          const timer = setTimeout(() => socket.destroy(new Error('TCP connection timeout')), context.options.timeoutMs);
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

    return {
      id: 'tcp-api',
      category: 'tcp',
      name: 'TCP 连接',
      target: `${host}:${port}`,
      status: 'pass',
      summary: '443 端口连接成功',
      latencyMs,
    };
  } catch (error) {
    const details = errorDetails(error);
    return {
      id: 'tcp-api',
      category: 'tcp',
      name: 'TCP 连接',
      target: `${host}:${port}`,
      status: 'fail',
      summary: `连接失败：${details.message}`,
      errorCode: details.code,
      remediation: '检查防火墙、VPN 节点、系统代理和到 api.openai.com:443 的路由。',
    };
  }
};

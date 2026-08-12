import tls from 'node:tls';
import type { Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

export const checkTls: Probe = async (context) => {
  const host = 'api.openai.com';

  try {
    const { value: details, latencyMs } = await measure(
      () =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true });
          const timer = setTimeout(() => socket.destroy(new Error('TLS handshake timeout')), context.options.timeoutMs);
          socket.once('secureConnect', () => {
            clearTimeout(timer);
            const certificate = socket.getPeerCertificate();
            const result = {
              protocol: socket.getProtocol(),
              cipher: socket.getCipher().name,
              authorized: socket.authorized,
              validTo: certificate.valid_to,
              issuer: certificate.issuer?.O,
            };
            socket.end();
            resolve(result);
          });
          socket.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
        }),
    );

    return {
      id: 'tls-api',
      category: 'tls',
      name: 'TLS 握手',
      target: `${host}:443`,
      status: 'pass',
      summary: `握手成功（${String(details.protocol)}）`,
      latencyMs,
      details,
    };
  } catch (error) {
    const details = errorDetails(error);
    return {
      id: 'tls-api',
      category: 'tls',
      name: 'TLS 握手',
      target: `${host}:443`,
      status: 'fail',
      summary: `握手失败：${details.message}`,
      errorCode: details.code,
      remediation: '检查系统时间、证书代理/HTTPS 解密、根证书和 VPN 节点。',
    };
  }
};

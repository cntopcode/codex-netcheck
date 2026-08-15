import tls from 'node:tls';
import { connectionTargets } from '../constants.js';
import type { CheckResult, Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

async function connectTls(host: string, timeoutMs: number) {
  return measure(
    () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const socket = tls.connect({
          host,
          port: 443,
          servername: host,
          rejectUnauthorized: true,
          ALPNProtocols: ['h2', 'http/1.1'],
        });
        const timer = setTimeout(
          () => socket.destroy(new Error('TLS handshake timeout')),
          timeoutMs,
        );
        socket.once('secureConnect', () => {
          clearTimeout(timer);
          const certificate = socket.getPeerCertificate();
          const result = {
            protocol: socket.getProtocol(),
            alpn: socket.alpnProtocol,
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
}

export const checkTls: Probe = async (context) => {
  const results: CheckResult[] = [];

  for (const target of connectionTargets(context.options)) {
    let lastError: unknown;
    let completed = false;

    // TLS 经代理或隧道时偶尔会被复位，短间隔重试一次可减少瞬时假阴性。
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const { value: details, latencyMs } = await connectTls(
          target.host,
          context.options.timeoutMs,
        );

        results.push({
          id: `tls-${target.id}`,
          category: 'tls',
          name: `${target.name} TLS 握手`,
          target: `${target.host}:443`,
          status: 'pass',
          summary: `握手成功（${String(details.protocol)}）`,
          latencyMs,
          details: { ...details, attempts: attempt },
        });
        completed = true;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (!completed) {
      const details = errorDetails(lastError);
      results.push({
        id: `tls-${target.id}`,
        category: 'tls',
        name: `${target.name} TLS 握手`,
        target: `${target.host}:443`,
        status: 'fail',
        summary: `握手失败：${details.message}`,
        errorCode: details.code,
        details: { attempts: 2 },
        remediation: '检查系统时间、证书代理/HTTPS 解密、根证书和 VPN 节点。',
      });
    }
  }

  return results;
};

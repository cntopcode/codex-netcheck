import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import tls from 'node:tls';
import { createProxyAgent, type ProxyRoute } from './proxy.js';
import { VERSION } from './constants.js';

export interface HttpsResult {
  status: number;
  headers: IncomingHttpHeaders;
  tls?: Record<string, unknown>;
}

export function requestHttps(target: string, route: ProxyRoute, timeoutMs: number, tlsOnly = false): Promise<HttpsResult> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const agent = createProxyAgent(route, timeoutMs, controller.signal);
    let settled = false;
    let metadata: Record<string, unknown> | undefined;
    const request = https.request(target, {
      method: 'HEAD', agent: agent ?? false,
      rejectUnauthorized: true,
      headers: { 'user-agent': `codex-netcheck/${VERSION}` },
    });
    const timer = setTimeout(() => finish(new Error('HTTPS/TLS 请求超时')), timeoutMs);
    function finish(error?: Error, result?: HttpsResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request.destroy();
      if (error) controller.abort();
      agent?.destroy();
      if (error) reject(error);
      else resolve(result!);
    }
    request.on('socket', (socket) => {
      if (!(socket instanceof tls.TLSSocket)) return;
      socket.once('secureConnect', () => {
        const certificate = socket.getPeerCertificate();
        metadata = { protocol: socket.getProtocol(), cipher: socket.getCipher()?.name,
          authorized: socket.authorized, validTo: certificate.valid_to, issuer: certificate.issuer?.O };
        if (tlsOnly) finish(undefined, { status: 0, headers: {}, tls: metadata });
      });
    });
    request.once('response', (response) => {
      const status = response.statusCode ?? 0;
      response.resume();
      if (tlsOnly && !metadata) finish(new Error(`代理隧道未建立 TLS（HTTP ${status}）`));
      else finish(undefined, { status, headers: response.headers, tls: metadata });
    });
    request.on('error', (error) => finish(error));
    request.end();
  });
}

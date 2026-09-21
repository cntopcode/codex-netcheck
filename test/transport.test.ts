import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { WebSocketServer } from 'ws';

const exec = promisify(execFile);
let directory: string;
let server: https.Server;
let proxy: http.Server;
let websocket: WebSocketServer;
let proxyPort: number;
let mode: 'allow' | 'reject' | 'hang' = 'allow';
let rejection = 407;
const sockets = new Set<net.Socket>();
const destinations: string[] = [];

function track(socket: net.Socket) { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); }
async function listen(server: net.Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as net.AddressInfo).port;
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'netcheck-test-'));
  // 仅在子进程中信任临时测试证书，产品代码仍严格校验证书。
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'),
    '-subj', '/CN=unresolvable.invalid', '-addext', 'subjectAltName=DNS:unresolvable.invalid']);
  server = https.createServer({ key: await readFile(join(directory, 'key.pem')), cert: await readFile(join(directory, 'cert.pem')) },
    (_request, response) => { response.writeHead(401); response.end(); });
  server.on('connection', track);
  websocket = new WebSocketServer({ server });
  const tlsPort = await listen(server);
  proxy = http.createServer();
  proxy.on('connection', track);
  proxy.on('connect', (request, socket, head) => {
    destinations.push(request.url!);
    if (mode === 'hang') return;
    if (mode === 'reject') { socket.end(`HTTP/1.1 ${rejection} Proxy Denied\r\nContent-Length: 0\r\n\r\n`); return; }
    const upstream = net.connect(tlsPort, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    track(upstream);
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
  });
  proxyPort = await listen(proxy);
}, 10_000);

afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  websocket?.close();
  await Promise.all([server, proxy].filter(Boolean).map((item) => new Promise<void>((resolve) => item.close(() => resolve()))));
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function child(script: string, trust = true) {
  const { stdout } = await exec(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { requestHttps } from './src/transport.ts';
    const route = { url: 'http://127.0.0.1:${proxyPort}', source: 'test' };
    ${script}
  `], { env: { ...process.env, NODE_EXTRA_CA_CERTS: trust ? join(directory, 'cert.pem') : '', NODE_TLS_REJECT_UNAUTHORIZED: '1' }, timeout: 5000 });
  return JSON.parse(stdout);
}

describe('真实本地 CONNECT 代理回归', () => {
  it('TLS、HTTPS、WSS 使用代理解析域名并完成握手', async () => {
    mode = 'allow';
    const result = await child(`
      import { checkWebSocket } from './src/checks/websocket.ts';
      import { WEBSOCKET_TARGET } from './src/constants.ts';
      WEBSOCKET_TARGET.url = 'wss://unresolvable.invalid/';
      const tls = await requestHttps('https://unresolvable.invalid/', route, 1000, true);
      const https = await requestHttps('https://unresolvable.invalid/', route, 1000);
      const ws = await checkWebSocket({ options: { timeoutMs: 1000 }, dnsAddresses: new Map(), proxyPolicy: { route, bypass: [] } });
      console.log(JSON.stringify({ tls: tls.tls.authorized, status: https.status, ws: ws.status }));
    `);
    expect(result).toEqual({ tls: true, status: 401, ws: 'pass' });
    expect(destinations.filter((host) => host === 'unresolvable.invalid:443').length).toBeGreaterThanOrEqual(3);
  });
  it('不关闭 TLS 校验来掩盖证书错误', async () => {
    mode = 'allow';
    const result = await child(`
      try { await requestHttps('https://unresolvable.invalid/', route, 1000); console.log(JSON.stringify({ ok: true })); }
      catch (error) { console.log(JSON.stringify({ code: error.code })); }
    `, false);
    expect(result.code).toMatch(/CERT|SELF_SIGNED/);
  });
  it('代理拒绝 CONNECT 时 TLS 检查必须失败', async () => {
    mode = 'reject';
    const result = await child(`
      try { await requestHttps('https://unresolvable.invalid/', route, 1000, true); console.log(JSON.stringify({ ok: true })); }
      catch (error) { console.log(JSON.stringify({ message: error.message })); }
    `);
    expect(result.message).toContain('407');
  });
  it('代理返回 403 不能冒充目标服务可达', async () => {
    mode = 'reject'; rejection = 403;
    const result = await child(`
      import { checkHttps } from './src/checks/https.ts';
      import { checkWebSocket } from './src/checks/websocket.ts';
      import { HTTPS_TARGETS, WEBSOCKET_TARGET } from './src/constants.ts';
      for (const target of HTTPS_TARGETS) target.url = 'https://unresolvable.invalid/';
      WEBSOCKET_TARGET.url = 'wss://unresolvable.invalid/';
      const context = { options: { timeoutMs: 1000 }, dnsAddresses: new Map(), proxyPolicy: { route, bypass: [] } };
      const https = await checkHttps(context);
      const ws = await checkWebSocket(context);
      console.log(JSON.stringify({ https: https.map(item => item.status), ws: ws.status }));
    `);
    expect(result).toEqual({ https: ['fail', 'fail'], ws: 'fail' });
    rejection = 407;
  });
  it('WebSocket 代理挂起时也能超时退出', async () => {
    mode = 'hang';
    const result = await child(`
      import { checkWebSocket } from './src/checks/websocket.ts';
      const ws = await checkWebSocket({ options: { timeoutMs: 100 }, dnsAddresses: new Map(), proxyPolicy: { route, bypass: [] } });
      console.log(JSON.stringify({ status: ws.status }));
    `);
    expect(result.status).toBe('fail');
  });
  it('CONNECT 无响应时按时退出，不能留下挂起连接', async () => {
    mode = 'hang';
    const result = await child(`
      try { await requestHttps('https://unresolvable.invalid/', route, 100); console.log(JSON.stringify({ ok: true })); }
      catch (error) { console.log(JSON.stringify({ message: error.message })); }
    `);
    expect(result.message).toMatch(/超时|aborted/);
  });
});

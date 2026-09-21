import WebSocket from 'ws';
import tls from 'node:tls';
import { routeFor, describeRoute, createProxyAgent } from '../proxy.js';
import { VERSION, WEBSOCKET_TARGET } from '../constants.js';
import type { Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

export const checkWebSocket: Probe = async (context) => {
  const route = routeFor(context, WEBSOCKET_TARGET.url);
  const controller = new AbortController();
  const agent = createProxyAgent(route, context.options.timeoutMs, controller.signal);
  let failed = false;
  try {
    const { value, latencyMs } = await measure(
      () =>
        new Promise<{ responseStatus?: number; responseMessage?: string; secure?: boolean }>((resolve, reject) => {
          let settled = false;
          const websocket = new WebSocket(WEBSOCKET_TARGET.url, {
            agent,
            rejectUnauthorized: true,
            handshakeTimeout: context.options.timeoutMs,
            headers: {
              'user-agent': `codex-netcheck/${VERSION}`,
              'openai-beta': 'realtime=v1',
            },
          });
          // ws 的 handshakeTimeout 在分配 socket 后才生效，额外覆盖代理 CONNECT 阶段。
          const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            websocket.terminate();
            reject(new Error('WebSocket/代理握手超时'));
          }, context.options.timeoutMs);
          const finish = (result: { responseStatus?: number; responseMessage?: string; secure?: boolean }) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            websocket.terminate();
            resolve(result);
          };
          websocket.once('open', () => finish({ secure: true }));
          websocket.once('unexpected-response', (_request, response) => {
            finish({ responseStatus: response.statusCode, responseMessage: response.statusMessage,
              secure: response.socket instanceof tls.TLSSocket && response.socket.authorized });
          });
          websocket.on('error', (error) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(error);
            }
          });
        }),
    );

    const reachable = value.secure && (value.responseStatus === undefined || [400, 401, 403, 404, 429].includes(value.responseStatus));
    return {
      id: 'websocket-realtime',
      category: 'websocket',
      name: WEBSOCKET_TARGET.name,
      target: WEBSOCKET_TARGET.url,
      status: !value.secure || value.responseStatus === 407 ? 'fail' : reachable ? 'pass' : 'warn',
      summary:
        !value.secure ? `代理连接失败（HTTP ${value.responseStatus}，未到达目标 TLS 服务）`
          : value.responseStatus === undefined ? 'WebSocket 已升级连接'
          : `已收到 HTTPS 响应（HTTP ${value.responseStatus}，未验证 WebSocket 升级或认证）`,
      latencyMs,
      details: { ...value, path: describeRoute(route) },
      remediation: reachable ? undefined : '检查代理是否支持 WebSocket Upgrade，并尝试切换节点。',
    };
  } catch (error) {
    failed = true;
    const details = errorDetails(error);
    return {
      id: 'websocket-realtime',
      category: 'websocket',
      name: WEBSOCKET_TARGET.name,
      target: WEBSOCKET_TARGET.url,
      status: 'fail',
      summary: `WebSocket 握手失败：${details.message}`,
      errorCode: details.code,
      details: { path: describeRoute(route) },
      remediation: '检查 WSS 分流、代理节点对 Upgrade 的支持以及 TLS 中间人。',
    };
  } finally {
    if (failed) controller.abort();
    agent?.destroy();
  }
};

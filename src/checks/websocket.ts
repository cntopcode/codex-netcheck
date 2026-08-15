import WebSocket from 'ws';
import { VERSION, WEBSOCKET_TARGET } from '../constants.js';
import type { Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

export const checkWebSocket: Probe = async (context) => {
  try {
    const { value, latencyMs } = await measure(
      () =>
        new Promise<{ responseStatus?: number; responseMessage?: string }>((resolve, reject) => {
          let settled = false;
          const websocket = new WebSocket(WEBSOCKET_TARGET.url, {
            handshakeTimeout: context.options.timeoutMs,
            headers: {
              'user-agent': `codex-netcheck/${VERSION}`,
              'openai-beta': 'realtime=v1',
            },
          });
          const finish = (result: { responseStatus?: number; responseMessage?: string }) => {
            if (settled) return;
            settled = true;
            websocket.terminate();
            resolve(result);
          };
          websocket.once('open', () => finish({}));
          websocket.once('unexpected-response', (_request, response) => {
            finish({ responseStatus: response.statusCode, responseMessage: response.statusMessage });
          });
          websocket.once('error', (error) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          });
        }),
    );

    const reachable = value.responseStatus === undefined || [400, 401, 403, 404, 429].includes(value.responseStatus);
    return {
      id: 'websocket-realtime',
      category: 'websocket',
      name: WEBSOCKET_TARGET.name,
      target: WEBSOCKET_TARGET.url,
      status: reachable ? 'pass' : 'warn',
      summary:
        value.responseStatus === undefined
          ? 'WebSocket 已升级连接'
          : `握手到达服务端（HTTP ${value.responseStatus}，未提供认证属于预期）`,
      latencyMs,
      details: value,
      remediation: reachable ? undefined : '检查代理是否支持 WebSocket Upgrade，并尝试切换节点。',
    };
  } catch (error) {
    const details = errorDetails(error);
    return {
      id: 'websocket-realtime',
      category: 'websocket',
      name: WEBSOCKET_TARGET.name,
      target: WEBSOCKET_TARGET.url,
      status: 'fail',
      summary: `WebSocket 握手失败：${details.message}`,
      errorCode: details.code,
      remediation: '检查 WSS 分流、代理节点对 Upgrade 的支持以及 TLS 中间人。',
    };
  }
};

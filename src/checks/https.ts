import { httpsTargets } from '../constants.js';
import type { CheckResult, Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

import { routeFor, describeRoute } from '../proxy.js';
import { requestHttps } from '../transport.js';

export const checkHttps: Probe = async (context) => {
  const results: CheckResult[] = [];

  for (const target of httpsTargets(context.options)) {
    const route = routeFor(context, target.url);
    let lastError: unknown;
    let completed = false;
    // 网络抖动时只重试一次，避免把偶发的连接复位误判为持续故障。
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const { value: response, latencyMs } = await measure(() =>
          requestHttps(target.url, route, context.options.timeoutMs),
        );
        const reachedService = !!response.tls && response.status !== 407;
        const accepted = reachedService && (target.acceptedStatuses as readonly number[]).includes(response.status);
        results.push({
          id: target.id,
          category: 'https',
          name: target.name,
          target: target.url,
          status: !reachedService ? 'fail' : accepted ? 'pass' : 'warn',
          summary: !reachedService ? `代理连接失败（HTTP ${response.status}，未到达目标 TLS 服务）`
            : accepted ? `HTTP ${response.status}，服务可达` : `收到非预期状态 HTTP ${response.status}`,
          latencyMs,
          details: {
            status: response.status,
            server: response.headers['server'],
            requestId: response.headers['x-request-id'],
            attempts: attempt,
            path: describeRoute(route),
          },
          remediation: !reachedService ? '检查代理地址、代理认证和 CONNECT 放行规则。'
            : accepted ? undefined : '服务可达，但响应状态异常；检查节点地区或上游网关。',
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
          id: target.id,
          category: 'https',
          name: target.name,
          target: target.url,
          status: 'fail',
          summary: `连续两次请求失败：${details.message}`,
          errorCode: details.code,
          details: { attempts: 2, path: describeRoute(route) },
          remediation: '检查 DNS、TLS、代理规则和 VPN 节点是否允许 HTTPS。',
        });
    }
  }

  return results;
};

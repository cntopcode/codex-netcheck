import { HTTPS_TARGETS } from '../constants.js';
import type { CheckResult, Probe } from '../types.js';
import { errorDetails, measure, withTimeout } from '../utils.js';

export const checkHttps: Probe = async (context) => {
  const results: CheckResult[] = [];

  for (const target of HTTPS_TARGETS) {
    let lastError: unknown;
    let completed = false;
    // 网络抖动时只重试一次，避免把偶发的连接复位误判为持续故障。
    for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { value: response, latencyMs } = await measure(() =>
        withTimeout(
          (signal) =>
            fetch(target.url, {
              method: 'HEAD',
              redirect: 'manual',
              signal,
              headers: { 'user-agent': 'codex-netcheck/0.1.0' },
            }),
          context.options.timeoutMs,
        ),
      );
      const accepted = (target.acceptedStatuses as readonly number[]).includes(response.status);
      results.push({
        id: target.id,
        category: 'https',
        name: target.name,
        target: target.url,
        status: accepted ? 'pass' : 'warn',
        summary: accepted ? `HTTP ${response.status}，服务可达` : `收到非预期状态 HTTP ${response.status}`,
        latencyMs,
        details: {
          status: response.status,
          server: response.headers.get('server'),
          requestId: response.headers.get('x-request-id'),
          attempts: attempt,
        },
        remediation: accepted ? undefined : '服务可达，但响应状态异常；检查节点地区、账户状态或上游网关。',
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
          details: { attempts: 2 },
          remediation: '检查 DNS、TLS、代理规则和 VPN 节点是否允许 HTTPS。',
        });
    }
  }

  return results;
};

import { routeFor, describeRoute } from '../proxy.js';
import { requestHttps } from '../transport.js';
import { connectionTargets } from '../constants.js';
import type { CheckResult, Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

export const checkTls: Probe = async (context) => {
  const results: CheckResult[] = [];

  for (const target of connectionTargets(context.options)) {
    const route = routeFor(context, `https://${target.host}`);
    let lastError: unknown;
    let completed = false;

    // TLS 经代理或隧道时偶尔会被复位，短间隔重试一次可减少瞬时假阴性。
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const { value, latencyMs } = await measure(() => requestHttps(
          `https://${target.host}/`, route, context.options.timeoutMs, true,
        ));
        const details = value.tls!;

        results.push({
          id: `tls-${target.id}`,
          category: 'tls',
          name: `${target.name} TLS 握手`,
          target: `${target.host}:443`,
          status: 'pass',
          summary: `握手成功（${String(details.protocol)}）`,
          latencyMs,
          details: { ...details, attempts: attempt, path: describeRoute(route) },
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
        details: { attempts: 2, path: describeRoute(route) },
        remediation: '检查系统时间、证书代理/HTTPS 解密、根证书和 VPN 节点。',
      });
    }
  }

  return results;
};

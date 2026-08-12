import { Resolver } from 'node:dns/promises';
import { OPENAI_HOSTS } from '../constants.js';
import type { CheckResult, Probe } from '../types.js';
import { errorDetails, measure } from '../utils.js';

export const checkDns: Probe = async (context) => {
  const resolver = new Resolver();
  const results: CheckResult[] = [];

  for (const host of OPENAI_HOSTS) {
    try {
      const { value, latencyMs } = await measure(() => resolver.resolve4(host));
      context.dnsAddresses.set(host, value);
      results.push({
        id: `dns-${host}`,
        category: 'dns',
        name: `DNS ${host}`,
        target: host,
        status: value.length > 0 ? 'pass' : 'fail',
        summary: value.length > 0 ? `解析成功（${value.length} 个 IPv4 地址）` : '未返回 IPv4 地址',
        latencyMs,
        details: { addresses: value },
        remediation: value.length === 0 ? '检查系统 DNS、VPN Fake-IP 配置或切换可信 DNS。' : undefined,
      });
    } catch (error) {
      const details = errorDetails(error);
      results.push({
        id: `dns-${host}`,
        category: 'dns',
        name: `DNS ${host}`,
        target: host,
        status: 'fail',
        summary: `解析失败：${details.message}`,
        errorCode: details.code,
        remediation: '检查系统 DNS、代理的 DNS 劫持/Fake-IP 设置和本地 hosts。',
      });
    }
  }

  return results;
};

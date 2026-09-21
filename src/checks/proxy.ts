import { diagnosticHosts } from '../constants.js';
import { describeRoute, discoverProxyPolicy, selectRoute } from '../proxy.js';
import type { Probe } from '../types.js';

export const checkProxy: Probe = async (context) => {
  context.proxyPolicy = await discoverProxyPolicy(context.options);
  const policy = context.proxyPolicy;
  return {
    id: 'proxy', category: 'proxy', name: '探针连接路径',
    status: policy.warning ? 'warn' : 'pass',
    summary: policy.warning ?? describeRoute(policy.route),
    details: {
      source: policy.route.source, proxy: policy.route.url, bypass: policy.bypass,
      targets: Object.fromEntries(diagnosticHosts(context.options).map((host) =>
        [host, describeRoute(selectRoute(policy, `https://${host}`))])),
    },
    remediation: policy.warning ? '用 --proxy 指定代理；用 --direct 单独检查直连/TUN 路径。' : undefined,
  };
};

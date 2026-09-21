export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export type CheckCategory =
  | 'environment'
  | 'proxy'
  | 'dns'
  | 'route'
  | 'tcp'
  | 'tls'
  | 'https'
  | 'websocket';

export interface CheckResult {
  id: string;
  category: CheckCategory;
  name: string;
  target?: string;
  status: CheckStatus;
  summary: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
  errorCode?: string;
  remediation?: string;
}

export interface RunOptions {
  proxy?: string;
  direct?: boolean;
  timeoutMs: number;
  includeSensitive: boolean;
  includeClaude?: boolean;
  language: 'zh' | 'en';
}

export interface DiagnosticReport {
  schemaVersion: 1;
  tool: {
    name: 'codex-netcheck';
    version: string;
  };
  generatedAt: string;
  durationMs: number;
  platform: {
    os: string;
    release: string;
    architecture: string;
    node: string;
  };
  summary: {
    status: CheckStatus;
    passed: number;
    warnings: number;
    failed: number;
    skipped: number;
    conclusion: string;
  };
  results: CheckResult[];
}

export interface ProbeContext {
  options: RunOptions;
  dnsAddresses: Map<string, string[]>;
  proxyPolicy?: import('./proxy.js').ProxyPolicy;
}

export type Probe = (context: ProbeContext) => Promise<CheckResult | CheckResult[]>;

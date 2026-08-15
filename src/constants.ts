import type { RunOptions } from './types.js';

export const VERSION = '0.2.0';

export const OPENAI_HOSTS = ['api.openai.com', 'chatgpt.com'] as const;
export const CLAUDE_HOSTS = ['api.anthropic.com', 'claude.ai'] as const;

export function diagnosticHosts(options: RunOptions): readonly string[] {
  return options.includeClaude ? [...OPENAI_HOSTS, ...CLAUDE_HOSTS] : OPENAI_HOSTS;
}

export const CONNECTION_TARGETS = [
  {
    id: 'api',
    provider: 'openai',
    name: 'OpenAI API',
    host: 'api.openai.com',
  },
  {
    id: 'claude-api',
    provider: 'claude',
    name: 'Claude API',
    host: 'api.anthropic.com',
  },
] as const;

export function connectionTargets(options: RunOptions) {
  return CONNECTION_TARGETS.filter(
    (target) => target.provider === 'openai' || options.includeClaude,
  );
}

export const HTTPS_TARGETS = [
  {
    id: 'https-api',
    provider: 'openai',
    name: 'OpenAI API HTTPS',
    url: 'https://api.openai.com/v1/models',
    acceptedStatuses: [200, 401, 403, 429],
  },
  {
    id: 'https-chatgpt',
    provider: 'openai',
    name: 'ChatGPT HTTPS',
    url: 'https://chatgpt.com/',
    acceptedStatuses: [200, 301, 302, 307, 308, 401, 403, 429],
  },
  {
    id: 'https-claude-api',
    provider: 'claude',
    name: 'Claude API HTTPS',
    url: 'https://api.anthropic.com/v1/messages',
    acceptedStatuses: [200, 400, 401, 403, 405, 429],
  },
  {
    id: 'https-claude-web',
    provider: 'claude',
    name: 'Claude Web HTTPS',
    url: 'https://claude.ai/',
    acceptedStatuses: [200, 301, 302, 307, 308, 401, 403, 429],
  },
] as const;

export function httpsTargets(options: RunOptions) {
  return HTTPS_TARGETS.filter(
    (target) => target.provider === 'openai' || options.includeClaude,
  );
}

export const WEBSOCKET_TARGET = {
  url: 'wss://api.openai.com/v1/realtime?model=gpt-realtime',
  name: 'OpenAI Realtime WebSocket',
};

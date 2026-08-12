export const VERSION = '0.1.0';

export const OPENAI_HOSTS = ['api.openai.com', 'chatgpt.com'] as const;

export const HTTPS_TARGETS = [
  {
    id: 'https-api',
    name: 'OpenAI API HTTPS',
    url: 'https://api.openai.com/v1/models',
    acceptedStatuses: [200, 401, 403, 429],
  },
  {
    id: 'https-chatgpt',
    name: 'ChatGPT HTTPS',
    url: 'https://chatgpt.com/',
    acceptedStatuses: [200, 301, 302, 307, 308, 401, 403, 429],
  },
] as const;

export const WEBSOCKET_TARGET = {
  url: 'wss://api.openai.com/v1/realtime?model=gpt-realtime',
  name: 'OpenAI Realtime WebSocket',
};

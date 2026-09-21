import { homedir } from 'node:os';

const SECRET_KEYS = /(?:api[_-]?key|authorization|cookie|password|passwd|proxy[_-]?authorization|token)/i;
const SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /\b(?:https?|socks(?:4a?|5h?)?):\/\/[^\s/@]+@/gi,
];

export function redactString(value: string, includeSensitive = false): string {
  if (includeSensitive) return value;

  let output = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, (match) => {
      if (match.includes('://')) return match.replace(/\/\/.*@/, '//***:***@');
      return '[REDACTED]';
    });
  }

  const home = homedir();
  if (home) output = output.split(home).join('~');
  return output;
}

export function redactValue(value: unknown, includeSensitive = false, key = ''): unknown {
  if (includeSensitive) return value;
  if (SECRET_KEYS.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, false, childKey),
      ]),
    );
  }
  return value;
}

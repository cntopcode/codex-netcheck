import { describe, expect, it } from 'vitest';
import { redactString, redactValue } from '../src/redact.js';

describe('redactString', () => {
  it('隐藏 OpenAI API key', () => {
    expect(redactString('key=sk-test_12345678901234567890')).toBe('key=[REDACTED]');
  });

  it('隐藏代理用户名和密码', () => {
    expect(redactString('http://alice:secret@127.0.0.1:7890')).toBe('http://***:***@127.0.0.1:7890');
  });
});

describe('redactValue', () => {
  it('按字段名隐藏敏感数据', () => {
    expect(redactValue({ token: 'abc', nested: { password: 'xyz' } })).toEqual({
      token: '[REDACTED]',
      nested: { password: '[REDACTED]' },
    });
  });
});

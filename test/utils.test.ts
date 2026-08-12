import { describe, expect, it } from 'vitest';
import { withTimeout } from '../src/utils.js';

describe('withTimeout', () => {
  it('正常返回异步结果', async () => {
    await expect(withTimeout(async () => 'ok', 100)).resolves.toBe('ok');
  });

  it('到期后触发 AbortSignal', async () => {
    await expect(
      withTimeout(
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          }),
        10,
      ),
    ).rejects.toThrow('aborted');
  });
});

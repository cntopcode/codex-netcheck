import { performance } from 'node:perf_hooks';

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function measure<T>(operation: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const startedAt = performance.now();
  const value = await operation();
  return { value, latencyMs: Math.round(performance.now() - startedAt) };
}

export function errorDetails(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    return { message: error.message, code };
  }
  return { message: String(error) };
}

export function normalizeAbortError(error: unknown): string {
  const details = errorDetails(error);
  if (details.message.includes('aborted') || details.code === 'ABORT_ERR') {
    return '请求超时';
  }
  return details.message;
}

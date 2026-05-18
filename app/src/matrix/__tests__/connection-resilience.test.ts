import { describe, it, expect } from 'vitest';
import { withTimeout, TimeoutError } from '../connection-resilience';

describe('withTimeout', () => {
  it('resolves with the value when fn settles in time', async () => {
    const result = await withTimeout(() => Promise.resolve(42), 1000, 'fast');
    expect(result).toBe(42);
  });

  it('rejects with TimeoutError when fn never settles', async () => {
    await expect(
      withTimeout(() => new Promise<never>(() => {}), 10, 'stuck'),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('propagates the original error when fn rejects before the timeout', async () => {
    const err = new Error('boom');
    await expect(
      withTimeout(() => Promise.reject(err), 1000, 'failing'),
    ).rejects.toBe(err);
  });
});

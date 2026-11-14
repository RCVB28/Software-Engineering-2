import { startRetentionScheduler } from '../../src/modules/audit/retention.scheduler';

describe('audit retention scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for the startup delay before the first run', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const stop = startRetentionScheduler({ run, startupDelayMs: 1000, intervalMs: 5000 });

    await jest.advanceTimersByTimeAsync(999);
    expect(run).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);

    stop();
  });

  it('runs again on the daily interval', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const stop = startRetentionScheduler({ run, startupDelayMs: 1000, intervalMs: 5000 });

    await jest.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(2);

    stop();
  });

  it('skips interval ticks while a run is still in progress', async () => {
    let finish: () => void = () => undefined;
    const run = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const stop = startRetentionScheduler({ run, startupDelayMs: 1000, intervalMs: 5000 });

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(5000);
    await jest.advanceTimersByTimeAsync(5000);

    expect(run).toHaveBeenCalledTimes(1);

    stop();
    finish();
  });

  it('logs a failed run and keeps scheduling later runs', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const run = jest
      .fn()
      .mockRejectedValueOnce(new Error('retention failed'))
      .mockResolvedValue(undefined);
    const stop = startRetentionScheduler({ run, startupDelayMs: 1000, intervalMs: 5000 });

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(5000);

    expect(run).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    stop();
  });

  it('unrefs timers and clears them on stop', () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const startupHandle = { unref: jest.fn() };
    const intervalHandle = { unref: jest.fn() };
    const timers = {
      setTimeout: jest.fn((_callback: () => void, _delayMs: number) => startupHandle),
      clearTimeout: jest.fn((_handle: unknown) => undefined),
      setInterval: jest.fn((_callback: () => void, _intervalMs: number) => intervalHandle),
      clearInterval: jest.fn((_handle: unknown) => undefined)
    };

    const stop = startRetentionScheduler({
      run,
      startupDelayMs: 1000,
      intervalMs: 5000,
      timers: timers as never
    });

    expect(startupHandle.unref).toHaveBeenCalled();

    const startupCallback = timers.setTimeout.mock.calls[0][0] as () => void;
    startupCallback();

    expect(intervalHandle.unref).toHaveBeenCalled();

    stop();
    expect(timers.clearInterval).toHaveBeenCalledWith(intervalHandle);
    expect(timers.clearTimeout).not.toHaveBeenCalled();
  });

  it('clears a pending startup timer when stopped early', () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const startupHandle = { unref: jest.fn() };
    const timers = {
      setTimeout: jest.fn((_callback: () => void, _delayMs: number) => startupHandle),
      clearTimeout: jest.fn((_handle: unknown) => undefined),
      setInterval: jest.fn((_callback: () => void, _intervalMs: number) => ({ unref: jest.fn() })),
      clearInterval: jest.fn((_handle: unknown) => undefined)
    };

    const stop = startRetentionScheduler({
      run,
      startupDelayMs: 1000,
      intervalMs: 5000,
      timers: timers as never
    });
    stop();

    expect(timers.clearTimeout).toHaveBeenCalledWith(startupHandle);
    expect(timers.setInterval).not.toHaveBeenCalled();
  });
});

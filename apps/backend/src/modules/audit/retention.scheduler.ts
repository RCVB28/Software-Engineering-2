export const DEFAULT_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_STARTUP_DELAY_MS = 5000;

export interface RetentionTimerApi {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (callback: () => void, intervalMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export interface RetentionSchedulerOptions {
  run: () => Promise<unknown>;
  intervalMs?: number;
  startupDelayMs?: number;
  timers?: RetentionTimerApi;
  onError?: (error: unknown) => void;
}

const defaultTimers: RetentionTimerApi = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>)
};

function safeUnref(handle: unknown): void {
  const timer = handle as { unref?: () => unknown } | null;
  if (timer && typeof timer.unref === 'function') timer.unref();
}

/**
 * Starts the audit retention scheduler. The first run happens after the startup delay, then on a
 * fixed interval. Returns a stop function that clears pending timers.
 */
export function startRetentionScheduler(options: RetentionSchedulerOptions): () => void {
  const run = options.run;
  const intervalMs = options.intervalMs ?? DEFAULT_RETENTION_INTERVAL_MS;
  const startupDelayMs = options.startupDelayMs ?? DEFAULT_RETENTION_STARTUP_DELAY_MS;
  const timers = options.timers ?? defaultTimers;
  const onError =
    options.onError ??
    ((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Audit retention scheduler run failed', error);
    });

  let stopped = false;
  let running = false;
  let startupHandle: unknown = null;
  let intervalHandle: unknown = null;

  const execute = () => {
    if (stopped || running) return;
    running = true;
    Promise.resolve()
      .then(() => run())
      .catch((error) => {
        onError(error);
      })
      .finally(() => {
        running = false;
      });
  };

  startupHandle = timers.setTimeout(() => {
    startupHandle = null;
    if (stopped) return;
    execute();
    intervalHandle = timers.setInterval(execute, intervalMs);
    safeUnref(intervalHandle);
  }, startupDelayMs);
  safeUnref(startupHandle);

  return function stopRetentionScheduler() {
    if (stopped) return;
    stopped = true;
    if (startupHandle !== null) {
      timers.clearTimeout(startupHandle);
      startupHandle = null;
    }
    if (intervalHandle !== null) {
      timers.clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };
}

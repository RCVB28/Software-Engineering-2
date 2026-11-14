import { app } from './app';
import { prisma } from './config/database';
import { env } from './config/env';
import { runAuditRetention } from './modules/audit/retention.job';
import { startRetentionScheduler } from './modules/audit/retention.scheduler';

let stopRetention: (() => void) | null = null;

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT}`);
  stopRetention = startRetentionScheduler({
    run: () => runAuditRetention(prisma),
    intervalMs: env.AUDIT_RETENTION_INTERVAL_MS,
    startupDelayMs: env.AUDIT_RETENTION_STARTUP_DELAY_MS
  });
});

async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down`);
  stopRetention?.();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

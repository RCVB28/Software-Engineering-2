import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { prisma } from './config/database';
import { errorHandler, notFound } from './middleware/error';
import { adminRouter } from './modules/admins/admin.routes';
import { alertRouter } from './modules/alerts/alert.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { authRouter } from './modules/auth/auth.routes';
import { locationRouter } from './modules/locations/locations.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { reportRouter } from './modules/reports/report.routes';
import { residentRouter } from './modules/residents/resident.routes';

export function createApp() {
  const app = express();

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    })
  );
  app.use(express.json({ limit: '100kb' }));

  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({ status: 'ok' });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.get('/health/db', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api', locationRouter);
  app.use('/api', authRouter);
  app.use('/api', residentRouter);
  app.use('/api', reportRouter);
  app.use('/api', alertRouter);
  app.use('/api', notificationRouter);
  app.use('/api', adminRouter);
  app.use('/api', auditRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();

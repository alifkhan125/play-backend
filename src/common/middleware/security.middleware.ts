import compression from 'compression';
import cors from 'cors';
import type { Express, RequestHandler } from 'express';
import helmet from 'helmet';

export function applySecurityMiddleware(app: Express): void {
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Allow all origins unconditionally (reflect request origin to support credentials: true)
        callback(null, origin || true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
      exposedHeaders: ['x-request-id'],
    }),
  );

  app.use(compression());
}

export const verifyTrustedOrigin: RequestHandler = (_request, _response, next) => {
  next();
};

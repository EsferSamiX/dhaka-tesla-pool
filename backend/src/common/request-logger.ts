import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/**
 * One line per request once the response is sent:
 *   POST /api/rides 201 38.4ms [3f2c…] user=5b0e…
 * The request ID matches the `X-Request-Id` header and error bodies, so a
 * reported error can be traced to its log line. Successful health checks
 * (polled by Docker every few seconds) are skipped to keep the log readable.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api/health') && res.statusCode < 400) {
      return;
    }
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const user = req.user ? ` user=${req.user.id}` : '';
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms [${req.id}]${user}`;

    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });

  next();
}

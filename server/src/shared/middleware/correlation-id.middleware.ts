import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export type RequestWithCorrelationId = Request & {
  correlationId?: string;
};

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incomingCorrelationId = request.header(CORRELATION_ID_HEADER);
    const correlationId =
      typeof incomingCorrelationId === 'string' &&
      incomingCorrelationId.trim().length > 0
        ? incomingCorrelationId.trim()
        : randomUUID();

    const requestWithCorrelationId = request as RequestWithCorrelationId;
    requestWithCorrelationId.correlationId = correlationId;

    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}

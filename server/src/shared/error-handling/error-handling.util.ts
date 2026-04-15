import {
  InternalServerErrorException,
  type LoggerService,
} from '@nestjs/common';

export function logAndThrowInternal(
  logger: Pick<LoggerService, 'error'>,
  contextMessage: string,
  publicMessage: string,
  error: unknown,
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`${contextMessage}: ${errorMessage}`, errorStack);
  throw new InternalServerErrorException(publicMessage);
}

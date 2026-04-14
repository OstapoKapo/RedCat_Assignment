import { Logger as NestLogger } from '@nestjs/common';
import { type LogLevel, type Logger, type QueryRunner } from 'typeorm';

export class TypeormLogger implements Logger {
  private readonly logger = new NestLogger('TypeORM');

  constructor(private readonly logQueries: boolean) {}

  logQuery(
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner,
  ): void {
    void queryRunner;

    if (!this.logQueries) {
      return;
    }

    if (parameters?.length) {
      this.logger.debug(`${query} -- params: ${JSON.stringify(parameters)}`);
      return;
    }

    this.logger.debug(query);
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner,
  ): void {
    void queryRunner;

    const formattedError = error instanceof Error ? error.message : error;
    const paramsSuffix = parameters?.length
      ? ` -- params: ${JSON.stringify(parameters)}`
      : '';

    this.logger.error(`${formattedError} -- ${query}${paramsSuffix}`);
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner,
  ): void {
    void queryRunner;

    const paramsSuffix = parameters?.length
      ? ` -- params: ${JSON.stringify(parameters)}`
      : '';

    this.logger.warn(`Slow query (${time}ms): ${query}${paramsSuffix}`);
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
    void queryRunner;
    this.logger.log(message);
  }

  logMigration(message: string, queryRunner?: QueryRunner): void {
    void queryRunner;
    this.logger.log(message);
  }

  log(level: LogLevel, message: unknown, queryRunner?: QueryRunner): void {
    void queryRunner;

    const normalizedMessage =
      typeof message === 'string' ? message : JSON.stringify(message);

    if (level === 'log' || level === 'info') {
      this.logger.log(normalizedMessage);
      return;
    }

    if (level === 'warn') {
      this.logger.warn(normalizedMessage);
      return;
    }

    this.logger.error(normalizedMessage);
  }
}

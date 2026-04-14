import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseShutdownService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (!this.dataSource.isInitialized) {
      return;
    }

    this.logger.log(
      `Closing PostgreSQL connection pool${signal ? ` on ${signal}` : ''}`,
    );
    await this.dataSource.destroy();
  }
}

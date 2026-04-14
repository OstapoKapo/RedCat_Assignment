import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? 3000);
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const stack = error instanceof Error ? error.stack : undefined;
  const message = error instanceof Error ? error.message : String(error);

  logger.error(`Application failed to start: ${message}`, stack);
  process.exit(1);
});

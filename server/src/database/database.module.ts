import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseShutdownService } from './database-shutdown.service';
import { TypeormLogger } from './typeorm.logger';

const DEFAULT_DB_PORT = 5432;
const DEFAULT_DB_NAME = 'redcat';
const DEFAULT_DB_USER = 'postgres';
const DEFAULT_DB_PASSWORD = 'postgres';
const DEFAULT_DB_HOST = 'localhost';

function getNumberEnv(
  config: ConfigService,
  key: string,
  fallback: number,
  min = 0,
): number {
  const rawValue = config.get<string>(key);
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < min) {
    throw new Error(`Invalid ${key}: "${rawValue}"`);
  }

  return parsedValue;
}

function getBooleanEnv(
  config: ConfigService,
  key: string,
  fallback: boolean,
): boolean {
  const rawValue = config.get<string>(key);
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallback;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new Error(`Invalid ${key}: "${rawValue}". Use "true" or "false".`);
}

function createTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const isTest = config.get<string>('NODE_ENV') === 'test';
  const databaseUrl = config.get<string>('DATABASE_URL');
  const dbSslEnabled = getBooleanEnv(config, 'DB_SSL', false);
  const dbSslRejectUnauthorized = getBooleanEnv(
    config,
    'DB_SSL_REJECT_UNAUTHORIZED',
    true,
  );

  const poolMin = getNumberEnv(config, 'DB_POOL_MIN', 2, 0);
  const poolMax = getNumberEnv(config, 'DB_POOL_MAX', 20, 1);
  const dbConnectionTimeout = getNumberEnv(
    config,
    'DB_CONNECTION_TIMEOUT_MS',
    10_000,
    1,
  );
  const dbIdleTimeout = getNumberEnv(config, 'DB_IDLE_TIMEOUT_MS', 30_000, 1);
  const dbStatementTimeout = getNumberEnv(
    config,
    'DB_STATEMENT_TIMEOUT_MS',
    15_000,
    1,
  );
  const dbQueryTimeout = getNumberEnv(config, 'DB_QUERY_TIMEOUT_MS', 15_000, 1);

  if (poolMin > poolMax) {
    throw new Error('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  }

  return {
    type: 'postgres',
    ...(databaseUrl
      ? {
          url: databaseUrl,
        }
      : {
          host: config.get<string>('DB_HOST', DEFAULT_DB_HOST),
          port: getNumberEnv(config, 'DB_PORT', DEFAULT_DB_PORT, 1),
          username: config.get<string>('DB_USERNAME', DEFAULT_DB_USER),
          password: config.get<string>('DB_PASSWORD', DEFAULT_DB_PASSWORD),
          database: config.get<string>('DB_NAME', DEFAULT_DB_NAME),
        }),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    manualInitialization: isTest,
    retryAttempts: 5,
    retryDelay: 3_000,
    maxQueryExecutionTime: getNumberEnv(
      config,
      'DB_SLOW_QUERY_THRESHOLD_MS',
      1_000,
      1,
    ),
    ssl: dbSslEnabled
      ? {
          rejectUnauthorized: dbSslRejectUnauthorized,
        }
      : undefined,
    logger: new TypeormLogger(!isProduction),
    extra: {
      min: poolMin,
      max: poolMax,
      connectionTimeoutMillis: dbConnectionTimeout,
      idleTimeoutMillis: dbIdleTimeout,
      statement_timeout: dbStatementTimeout,
      query_timeout: dbQueryTimeout,
      keepAlive: true,
      application_name: 'redcat-server',
    },
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmOptions,
    }),
  ],
  providers: [DatabaseShutdownService],
})
export class DatabaseModule {}

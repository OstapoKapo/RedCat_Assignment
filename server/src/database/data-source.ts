import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';

function getNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${key}: "${raw}"`);
  }

  return parsed;
}

function getBooleanEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  if (raw === 'true') {
    return true;
  }

  if (raw === 'false') {
    return false;
  }

  throw new Error(`Invalid ${key}: "${raw}". Use "true" or "false".`);
}

const dbSslEnabled = getBooleanEnv('DB_SSL', false);
const dbSslRejectUnauthorized = getBooleanEnv(
  'DB_SSL_REJECT_UNAUTHORIZED',
  true,
);

export default new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: getNumberEnv('DB_PORT', 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'redcat',
      }),
  entities: [UserEntity],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
  ssl: dbSslEnabled
    ? {
        rejectUnauthorized: dbSslRejectUnauthorized,
      }
    : undefined,
});

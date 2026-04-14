# RedCat_Assignment

## Docker Compose

Run all services (server + PostgreSQL + Redis):

```bash
docker compose up --build
```

Stop and remove containers:

```bash
docker compose down
```

## Database (TypeORM)

The server connects to PostgreSQL via TypeORM.
Primary option is `DATABASE_URL`, example:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/redcat
```

Additional available settings:
- `DB_POOL_MIN`, `DB_POOL_MAX`
- `DB_CONNECTION_TIMEOUT_MS`, `DB_IDLE_TIMEOUT_MS`
- `DB_STATEMENT_TIMEOUT_MS`, `DB_QUERY_TIMEOUT_MS`
- `DB_SLOW_QUERY_THRESHOLD_MS`
- `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`

## Default admin seed

On startup, the app can seed a default admin user.

Required environment variables:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Optional:
- `SEED_ADMIN_ON_STARTUP` (`true` by default, set `false` to disable)

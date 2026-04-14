# RedCat_Assignment

## Docker Compose

Запуск усіх сервісів (server + PostgreSQL + Redis):

```bash
docker compose up --build
```

Зупинити та прибрати контейнери:

```bash
docker compose down
```

## Database (TypeORM)

Сервер підключає PostgreSQL через TypeORM.
Основний спосіб — `DATABASE_URL`, приклад:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/redcat
```

Додатково доступні налаштування:
- `DB_POOL_MIN`, `DB_POOL_MAX`
- `DB_CONNECTION_TIMEOUT_MS`, `DB_IDLE_TIMEOUT_MS`
- `DB_STATEMENT_TIMEOUT_MS`, `DB_QUERY_TIMEOUT_MS`
- `DB_SLOW_QUERY_THRESHOLD_MS`
- `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`

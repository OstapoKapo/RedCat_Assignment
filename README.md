# RedCat Assignment

NestJS backend for authentication, role-based access control, billing (deposit/transfer/cancel), and webhook notifications for transactions.

## Tech Stack

- NestJS
- TypeORM
- PostgreSQL
- JWT (access + refresh, cookie-based auth)
- Swagger
- Docker / Docker Compose

## Features

- Registration and login with `HttpOnly` cookies
- Refresh token rotation and logout
- Roles: `ADMIN`, `CLIENT`
- User management and account activation/deactivation
- Billing:
  - deposit
  - transfer
  - cancel transaction
  - transaction listing
- Idempotency key support for billing operations
- Webhook events for created/cancelled transactions
- Global exception filter + correlation id middleware

## Project Structure

- `server/` — NestJS application
- `docker-compose.yml` — app + PostgreSQL orchestration
- `server/src/database/migrations/` — TypeORM migrations

## Environment Variables

### Root (`.env`) for Docker Compose

```env
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=redcat
```

### Server (`server/.env`)

```env
NODE_ENV=development
PORT=3000

# CORS
CORS_ORIGINS=http://localhost:3000

# Webhook
WEBHOOK_DESTINATION_URL=https://webhook.site/your-id

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/redcat
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=redcat
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true

# Admin seed
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=StrongPass123!
SEED_ADMIN_ON_STARTUP=true

# JWT
JWT_ACCESS_SECRET=dev-access-secret
JWT_ACCESS_EXPIRES_IN_SECONDS=900
JWT_REFRESH_SECRET=dev-refresh-secret
JWT_REFRESH_EXPIRES_IN_SECONDS=604800
JWT_COOKIE_SECURE=false
JWT_COOKIE_SAME_SITE=lax
JWT_ACCESS_COOKIE_MAX_AGE_MS=900000
JWT_REFRESH_COOKIE_MAX_AGE_MS=604800000
```

## Run with Docker

From repository root:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

App: `http://localhost:3000`  
Swagger: `http://localhost:3000/api/docs`

## Run Locally (without Docker)

```bash
cd server
npm ci
npm run migration:push
npm run start:dev
```

## Migrations

From `server/`:

```bash
# generate migration
npm run migration:create --name=YourMigrationName

# apply migrations
npm run migration:push

# rollback last migration
npm run migration:rollback
```

## API Overview

### Auth (`/auth`)

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

### Users (`/users`)

- Admin: create/read/list users, change roles, activate users
- Self/Admin: read/update own profile, change password, deactivate account
- Pagination: `GET /users?page=1&limit=20`

### Billing (`/billing`)

- `POST /billing/:id/deposit`
- `POST /billing/:id/transfer`
- `POST /billing/:id/cancel/:transactionId`
- `GET /billing/:id/transactions`
- `GET /billing/transactions` (admin)

Billing endpoints support optional header:

```http
x-idempotency-key: your-unique-key
```

## Webhook

When transaction is created or cancelled, app emits event and sends webhook payload to `WEBHOOK_DESTINATION_URL`.

Payload format:

```json
{
  "eventId": "uuid",
  "type": "DEPOSIT|TRANSFER|CANCEL",
  "status": "COMPLETED|CANCELLED",
  "amount": "100.00",
  "senderEmail": "sender@example.com",
  "receiverEmail": "receiver@example.com",
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

If URL is missing, sending is skipped with warning log.

## Testing and Quality

From `server/`:

```bash
npm run lint:check
npm test -- --runInBand
npm run build
```

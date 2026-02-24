# Wallet Service

<p align="left">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Ledger%20Store-336791?logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-Rate%20Limit%20%26%20Idempotency-DC382D?logo=redis&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white">
</p>

Wallet and transfer microservice for the fintech platform.

## Responsibilities

- Wallet creation
- Ledger-based balance management
- Internal transfers
- External transfers (NIBSS simulator-ready)
- Reversal processing
- Idempotent transfer handling
- Transfer audit logging

## Architecture

```text
Client -> API Gateway -> Wallet Service -> PostgreSQL
                                   \-> Redis (idempotency + rate limit)
                                   \-> NIBSS Simulator (external transfer flow)
```

## Project Structure

```text
wallet-service/
├── prisma/
├── src/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── events/
│   ├── middlewares/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   └── app.js
├── .env.example
├── package.json
└── server.js
```

## Prerequisites

- Node.js `18+`
- `pnpm`
- PostgreSQL
- Redis

## Environment Variables

Use `.env.example` as your template.

| Variable | Description |
|---|---|
| `NODE_ENV` | Environment |
| `PORT` | Service port (default `5000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | Must match auth-service access secret |
| `NIBSS_SIMULATOR_URL` | External transfer simulator URL |
| `NIBSS_API_KEY` | Optional outbound API key |
| `NIBSS_WEBHOOK_SECRET` | Optional webhook secret validation |
| `SETTLEMENT_ACCOUNT_NUMBER` | Internal settlement wallet account number |
| `IDEMPOTENCY_TTL_SECONDS` | Idempotency retention in Redis |
| `TRANSFER_RATE_LIMIT_WINDOW_SECONDS` | Transfer rate-limit window |
| `TRANSFER_RATE_LIMIT_MAX_ATTEMPTS` | Max transfers per window |

## Setup

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

## Health Check

- `GET /health`

## API Endpoints

Base URL: `http://localhost:5000`

### Wallets

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/wallets` | Create wallet for authenticated user |
| `GET` | `/wallets/me` | Retrieve current user wallet |
| `GET` | `/wallets/me/balance` | Compute balance from ledger entries |

### Transfers

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/transfers/internal` | Internal wallet-to-wallet transfer |
| `POST` | `/transfers/external` | External transfer |
| `POST` | `/transfers/:transactionId/reverse` | Reverse successful transaction |
| `POST` | `/transfers/webhook/nibss` | NIBSS callback endpoint |

## Controls and Guarantees

- JWT validation using auth-service access secret.
- Idempotency key required for transfer endpoints.
- Redis-backed transfer rate limiting.
- State transition validation for transaction lifecycle.
- Row-level locking for concurrency-sensitive operations.
- Ledger entries are append-only; reversals create compensating entries.

## License

ISC

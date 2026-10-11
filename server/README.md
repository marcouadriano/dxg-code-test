# Server

The API and the audit worker, built with NestJS, MongoDB and Redis.

To run it with Docker, see the [main README](../README.md). This page covers running it with Node.

## Setup

```bash
pnpm install
cp .env.example .env
```

Then add the sign-in keys to `.env`, the same way as in the [main README](../README.md#1-start-the-backend).

## Database

Mongo has to run as a replica set, because adding an employee uses a transaction. A single node is enough:

```bash
mongod --replSet rs0 --dbpath <dir>
mongosh --eval 'rs.initiate()'
```

Point `MONGODB_URI` and `AUDIT_MONGODB_URI` in `.env` at it, and `REDIS_URL` at your Redis.

To create the first HR admin, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` and run:

```bash
pnpm seed:admin
```

## Run

```bash
pnpm start:dev           # the API on http://localhost:3000, restarts when you edit code
pnpm start:audit-worker  # the audit worker, in a second terminal
```

## Audit worker

When an employee changes their phone, photo or password, the API adds an event to the Redis stream `profile-changes`. Two things read it:

- the HR admin app, which shows a popup (it listens on `GET /employees/profile-changes`)
- the audit worker, a separate process that saves every event to its own database (`AUDIT_MONGODB_URI`, collection `profile_changes`)

The worker reads the stream as the consumer group `audit-log`. If it's stopped, events wait in the stream and get saved once it's back.

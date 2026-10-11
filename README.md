# WFH Attendance

A fullstack skill test project: an attendance app for employees working from home, plus an HR admin app.

- `server/`: the API and the audit worker (NestJS, MongoDB, Redis)
- `client-admin/`: the HR admin app
- `client-employee/`: the employee app

## What you need

- Docker with Docker Compose, or Podman with podman-compose
- Node.js 24 and pnpm for the two web apps
- OpenSSL to make the sign-in keys

## 1. Start the backend

Make your own `server/.env` from the example:

```bash
cp server/.env.example server/.env
```

The API signs its tokens with a key pair, so make one. These commands print two lines; paste them into `server/.env` in place of the empty `JWT_PRIVATE_KEY=` and `JWT_PUBLIC_KEY=`:

```bash
openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out private.pem
openssl ec -in private.pem -pubout -out public.pem
echo "JWT_PRIVATE_KEY=\"$(awk '{printf "%s\\n", $0}' private.pem)\""
echo "JWT_PUBLIC_KEY=\"$(awk '{printf "%s\\n", $0}' public.pem)\""
```

Leave `JWT_KEY_ID` as `key-1`.

Start Mongo, Redis, the API and the audit worker:

```bash
docker compose up -d --build
```

Then create the first HR admin (the password needs at least 8 characters):

```bash
docker compose run --rm -e ADMIN_EMAIL=admin@company.com -e ADMIN_PASSWORD=<password> api node dist/seed-admin.js
```

The API should now answer at http://localhost:3000.

## 2. Start the web apps

In one terminal:

```bash
cd client-admin
pnpm install
pnpm dev
```

And in another:

```bash
cd client-employee
pnpm install
pnpm dev
```

| App          | URL                   | Sign in with                         |
| ------------ | --------------------- | ------------------------------------ |
| HR admin     | http://localhost:5173 | the admin you just created           |
| Employee app | http://localhost:5174 | an employee you add in the admin app |

To see the notifications, keep the admin app open and change a phone number, photo or password in the employee app. A popup shows up in the bottom-right corner of the admin app.

## 3. Stop

```bash
docker compose down     # stops everything, keeps the data
docker compose down -v  # also wipes the data and uploaded photos
```

On Podman, use `podman-compose` instead of `docker compose`. If you'd rather run the server straight from Node, see [server/README.md](server/README.md).

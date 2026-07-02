# Message Scheduling Service

Standalone Node.js/TypeScript microservice that schedules delayed messages and, when the
scheduled time arrives, calls a webhook on your .NET backend. It does not send messages
itself — it is purely a scheduler/dispatcher sitting in front of Redis + BullMQ.

## Quick start

```bash
cp .env.example .env      # then edit MAIN_BACKEND_URL etc.
npm install
docker compose up -d redis   # or run your own Redis
npm run dev                  # http://localhost:4000
```

Production build:

```bash
npm run build
npm start
```

Full stack in Docker:

```bash
docker compose up --build
```

## API

| Method | Path                | Description                          |
|--------|---------------------|---------------------------------------|
| GET    | `/health`            | Liveness/readiness check              |
| POST   | `/schedule-message`  | Schedule a delayed message            |
| GET    | `/jobs/:id`          | Get job status/details                |
| DELETE | `/jobs/:id`          | Cancel a scheduled message             |
| PATCH  | `/jobs/:id`          | Reschedule (body: `{ "scheduledAt": "..." }`) |

`POST /schedule-message` body:

```json
{
  "messageId": "msg_123",
  "conversationId": "conv_100",
  "senderId": "user_10",
  "scheduledAt": "2026-08-01T10:30:00Z",
  "webhookPayload": { "text": "Hello", "type": "text" }
}
```

The `messageId` is reused as the BullMQ job ID, so re-submitting the same `messageId`
is naturally idempotent instead of creating a duplicate job.

## How BullMQ delayed jobs work internally

- Redis stores each queue as a family of keys (`bull:<queue>:*`): a list for waiting jobs,
  a sorted set for delayed jobs, a hash per job for its data, plus sets for active/completed/failed.
- When you call `queue.add(name, data, { delay })`, BullMQ writes the job's hash and adds
  its ID to the **delayed** sorted set, scored by `Date.now() + delay`. No timer runs in your
  Node process — the "waiting" is entirely encoded in Redis.
- A background mechanism inside BullMQ (driven by the Worker's connection, using Redis's
  `BZPOPMIN`-style blocking commands plus a periodic check) moves jobs from the delayed set
  to the **wait** list once their score is `<= now`. Because this logic lives in Redis/BullMQ
  rather than in application memory, delayed jobs survive process restarts and work correctly
  across multiple worker instances.
- A `Worker` then picks jobs off the wait list (respecting `concurrency`) and executes your
  processor function.
- **Note on `QueueScheduler`:** older BullMQ versions (pre-v3) needed a separate
  `QueueScheduler` instance to promote delayed jobs and handle stalled-job recovery. Since
  BullMQ v3+, this responsibility was folded directly into `Queue`/`Worker`, so a standalone
  `QueueScheduler` class no longer exists (this project uses BullMQ ^5.x). You do not need to
  instantiate one — it would in fact fail to import.

## How retries and failures are handled

- Each job is created with `attempts` (default 5) and an `exponential` `backoff` starting at
  `JOB_BACKOFF_DELAY_MS` (default 5s): retry delays roughly double each time (5s, 10s, 20s, ...).
- If the worker's processor throws (which `webhook.service.ts` does on any non-2xx response
  or network error), BullMQ marks the attempt failed, and if `attemptsMade < attempts`, it
  re-queues the job into the delayed set with the next backoff delay.
- Once `attemptsMade === attempts` and it still fails, the job is moved to the **failed**
  set and stays there until `removeOnFail.age` (default 24h) elapses, so you have a window to
  inspect/replay failures via `GET /jobs/:id` or Redis directly.
- Successful jobs are kept for `removeOnComplete.age` (default 1h) for auditability, then
  automatically pruned so Redis memory doesn't grow unbounded.
- **Stalled jobs:** if a worker process crashes mid-job (so it never calls back to mark
  completed/failed), BullMQ's stall-detection (via the worker's periodic lock renewal)
  eventually notices the lock expired and re-queues the job for another attempt — this is
  what the `stalled` event in `queue.events.ts` reports.

## Scaling workers horizontally

- Workers are stateless consumers of the same Redis-backed queue, so you can run multiple
  instances of this service (or just multiple `Worker` processes) safely — BullMQ guarantees
  a given job is only delivered to one worker at a time via Redis locks.
- Two scaling knobs:
  1. **Vertical**: raise `WORKER_CONCURRENCY` so one process handles more jobs in parallel
     (safe here since the work is I/O-bound HTTP calls, not CPU-bound).
  2. **Horizontal**: run more replicas of the container (e.g. `docker compose up --scale scheduler=3`,
     or a Kubernetes `Deployment` with `replicas: 3`). All replicas connect to the same Redis
     and the same `QUEUE_NAME`; BullMQ fairly distributes jobs across them.
- If you want to scale the HTTP API and the worker independently (e.g. lots of scheduling
  traffic but modest delivery volume, or vice versa), split `createApp()`/`startServer()`
  into two separate entrypoints/processes that both point at the same Redis — the code is
  already structured so the Express app and the Worker don't depend on being in the same process.
- Redis itself is the shared bottleneck/source of truth; for high volume, run Redis with
  persistence (AOF, already enabled in `docker-compose.yml`) and consider Redis Cluster or
  a managed Redis (e.g. ElastiCache, Azure Cache for Redis) with appropriate memory sizing.

## Deploying to production

1. **Build once, run everywhere**: `docker build -t message-scheduling-service .` produces a
   small multi-stage image (compiles TypeScript, then ships only `dist/` + prod deps).
2. **Externalize Redis**: don't use the bundled `docker-compose.yml` Redis for production —
   point `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`/`REDIS_TLS` at a managed, persistent Redis.
3. **Secrets**: inject `.env` values via your platform's secret manager rather than baking
   them into the image (Kubernetes Secrets, Docker secrets, AWS Secrets Manager, etc.).
4. **Health checks**: the `/health` endpoint and the Dockerfile `HEALTHCHECK` are ready for
   Kubernetes liveness/readiness probes or an ALB/NLB target group health check.
5. **Graceful shutdown**: the service already handles `SIGTERM`/`SIGINT` by draining the HTTP
   server and letting in-flight jobs finish before exiting — make sure your orchestrator's
   termination grace period (e.g. Kubernetes `terminationGracePeriodSeconds`) is long enough
   to cover your longest webhook timeout.
6. **Observability**: logs are structured JSON via `pino` in production — ship them to your
   log aggregator (CloudWatch, Datadog, ELK). Add BullMQ metrics (e.g. via `bullmq`'s
   `Queue.getJobCounts()` on an interval, or Bull Board / a Prometheus exporter) for
   queue-depth and failure-rate dashboards.
7. **Networking**: ensure the container can reach `MAIN_BACKEND_URL` over your internal
   network, and put a shared secret (`WEBHOOK_AUTH_HEADER`/`WEBHOOK_AUTH_TOKEN`) or mTLS in
   front of the .NET webhook so it isn't callable by anything except this scheduler.

## Project structure

```
src/
├── config/        env, redis connection factory, BullMQ defaults
├── controllers/    thin HTTP handlers
├── routes/          Express route wiring
├── services/         business logic (scheduling, webhook call, job queries)
├── queues/            Queue, Worker, QueueEvents definitions
├── middleware/        Zod validation + centralized error handling
├── interfaces/         shared TypeScript types
├── utils/               logger, date helpers
├── app.ts               Express app factory
├── server.ts             boots HTTP server + worker + graceful shutdown
└── index.ts               entrypoint
```

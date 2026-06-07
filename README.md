# n-strument

Instrumentation helper library.

A zero-config-code bootstrap for [OpenTelemetry](https://opentelemetry.io/) distributed tracing in Node.js apps. Importing it wires up auto-instrumentation and an OTLP exporter for you — there is no API to call.

## Installation

```bash
npm install @nivinjoseph/n-strument
# or
yarn add @nivinjoseph/n-strument
```

## Usage

This is primarily a **side-effect-on-import module**: importing it sets up auto-instrumentation and the OTLP exporter. It also exports a single `shutdownTracing` function for draining spans on shutdown (see below). Import it once, as the **very first import** in your application's entry point, before any module you want traced is loaded:

```ts
// main.ts — the FIRST import, before koa/pg/redis/aws-sdk/etc.
import "@nivinjoseph/n-strument";

// ...the rest of your app
import { startServer } from "./server.js";
startServer();
```

Order matters: OpenTelemetry auto-instrumentation patches modules at load time, so anything imported before `n-strument` will not be traced. For a guaranteed-first load you can preload it via Node instead:

```bash
node --import @nivinjoseph/n-strument ./dist/main.js
```

n-strument does not expose an API for creating custom spans. It sets up the global tracer provider, so use [`@opentelemetry/api`](https://www.npmjs.com/package/@opentelemetry/api) directly for manual instrumentation:

```ts
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("my-service");
const span = tracer.startSpan("do-work");
// ...
span.end();
```

### Graceful shutdown

Spans are buffered in memory by a `BatchSpanProcessor` and flushed periodically. On process exit that buffer is **not** drained automatically, so the spans around a deploy, scale-down, or shutdown — often the ones you most want — can be lost. n-strument does **not** register its own `SIGTERM`/`SIGINT` handlers (that would race with, and prematurely exit out of, your service's shutdown). Instead it exports `shutdownTracing`, which you call as the **last** step of your own graceful-shutdown sequence — after you've stopped accepting work and finished in-flight requests, so their spans are captured:

```ts
import { shutdownTracing } from "@nivinjoseph/n-strument";

async function onShutdown(): Promise<void>
{
    await server.stop();      // stop accepting traffic, drain in-flight requests
    await db.dispose();       // your other cleanup
    await shutdownTracing();  // flush + shut down the exporter, last
}
```

`shutdownTracing()` flushes the buffer and shuts the exporter down. It is idempotent — repeat calls return the same shutdown — so it's safe to wire into multiple paths.

This works with the `node --import` style too: ES modules are singletons, so importing `shutdownTracing` from your code returns the same instance that `--import` already loaded, operating on the same tracer provider.

## Configuration

All settings are read through [`@nivinjoseph/n-config`](https://www.npmjs.com/package/@nivinjoseph/n-config)'s `ConfigurationManager` (environment variables / config files).

| Config key                          | Required | Default                                | Purpose                                                              |
| ----------------------------------- | -------- | -------------------------------------- | ------------------------------------------------------------------- |
| `env`                               | **Yes**  | —                                      | App environment. Throws on startup if missing. `"dev"` defaults the trace host to `localhost`. |
| `package_name` (or `package.name`)  | No       | —                                      | Sets the `service.name` resource attribute.                         |
| `package.version`                   | No       | —                                      | Sets the `service.version` resource attribute.                      |
| `otelTraceSamplingRate`             | No       | `1` (100%)                             | Parent-based ratio sampler.                                         |
| `enableXrayTracing`                 | No       | `false`                                | Use the AWS X-Ray ID generator + propagator.                       |
| `otelTraceHost`                     | No       | `localhost` (dev) / `0.0.0.0` (other)  | Host of the OTLP collector.                                         |

> ⚠️ If `env` is not set, importing the module throws immediately:
> `ApplicationException: Required config 'env' not found`.

## Backend / infrastructure

Spans are exported over **OTLP/HTTP** to `http://<otelTraceHost>:4318/v1/traces`. You need an OpenTelemetry Collector — or any OTLP-HTTP-compatible backend (Jaeger, Grafana Tempo, AWS Distro for OpenTelemetry, etc.) — listening on port **4318**. Without one, the app still runs but span exports fail in the background.

### Minimal local setup

```bash
# configuration (env vars, or however your n-config is wired)
export env=dev
export package_name=my-service
export package.version=1.0.0

# run a collector on :4318
docker run -p 4318:4318 otel/opentelemetry-collector
```

## What gets instrumented

The following auto-instrumentations are enabled. This set is fixed and not configurable without editing the library — but the full list of instrumentations is declared explicitly in `src/index.ts`, so flipping one on or off is a one-line `enabled` change:

- HTTP
- gRPC
- PostgreSQL (`pg`)
- Knex
- Redis / ioredis
- Koa (middleware-layer spans are suppressed)
- AMQP / RabbitMQ (`amqplib`)
- Kafka (`kafkajs`)
- Socket.IO
- AWS SDK
- AWS Lambda

Every other instrumentation that `@opentelemetry/auto-instrumentations-node` ships (Express, Hapi, NestJS, MongoDB, MySQL, GraphQL, DNS, `fs`, the logging integrations, etc.) is explicitly disabled.

To change the set, edit the `instrumentationConfig` map in [`src/index.ts`](src/index.ts) — it lists every instrumentation the library knows about with an explicit `enabled` flag, so toggling one is a single `true`/`false` edit. The map is typed `Required<InstrumentationConfigMap>`, which means a future `@opentelemetry/auto-instrumentations-node` upgrade that adds a new instrumentation will fail the build until you add the key and make a deliberate enabled/disabled decision (rather than letting it silently default to on).

## License

MIT

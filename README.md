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

This is a **side-effect-only module** — it has no exports. Import it once, as the **very first import** in your application's entry point, before any module you want traced is loaded:

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

The following auto-instrumentations are enabled (this set is fixed and not configurable without editing the library):

- HTTP
- gRPC
- Redis / ioredis
- PostgreSQL (`pg`)
- Knex
- Koa (middleware-layer spans are suppressed)
- AWS SDK
- AWS Lambda

## License

MIT

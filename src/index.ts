import { getNodeAutoInstrumentations, InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import
    {
        // SemanticResourceAttributes,
        ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION
    } from "@opentelemetry/semantic-conventions";
import { NodeTracerProvider, ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-node";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { BatchSpanProcessor, TracerConfig } from "@opentelemetry/sdk-trace-base";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ConfigurationManager } from "@nivinjoseph/n-config";
import { KoaLayerType } from "@opentelemetry/instrumentation-koa";
import { TypeHelper } from "@nivinjoseph/n-util";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { AWSXRayIdGenerator } from "@opentelemetry/id-generator-aws-xray";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);




// Every key in the InstrumentationConfigMap is listed explicitly with an `enabled` flag. The
// config object is an *override map*, not an allow-list: any instrumentation left out (or set to
// `undefined`) runs at its own default, which for this library version means ~39 of 40 are on.
// Listing all of them makes the enabled set unambiguous and makes a future library version that
// adds a new instrumentation conspicuous by its absence here, instead of silently turning on.
//
// Enabled: http, grpc, pg, knex, redis, ioredis, koa, amqplib, kafkajs, socket.io, aws-sdk,
// aws-lambda. Everything else off.
// Entries are kept in the library's own InstrumentationMap order for easy auditing on upgrade.
// `Required<...>` strips the optional modifier off every key, so this literal must list every
// instrumentation the library knows about. When an OTel upgrade adds a new one, the missing key
// becomes a compile error here — forcing a deliberate enabled/disabled decision rather than a
// silent default-on.
const instrumentationConfig: Required<InstrumentationConfigMap> = {
    "@opentelemetry/instrumentation-amqplib": { enabled: true },
    "@opentelemetry/instrumentation-aws-lambda": { enabled: true },
    "@opentelemetry/instrumentation-aws-sdk": { enabled: true },
    "@opentelemetry/instrumentation-bunyan": { enabled: false },
    "@opentelemetry/instrumentation-cassandra-driver": { enabled: false },
    "@opentelemetry/instrumentation-connect": { enabled: false },
    "@opentelemetry/instrumentation-cucumber": { enabled: false },
    "@opentelemetry/instrumentation-dataloader": { enabled: false },
    "@opentelemetry/instrumentation-dns": { enabled: false },
    "@opentelemetry/instrumentation-express": { enabled: false },
    "@opentelemetry/instrumentation-fs": { enabled: false },
    "@opentelemetry/instrumentation-generic-pool": { enabled: false },
    "@opentelemetry/instrumentation-graphql": { enabled: false },
    "@opentelemetry/instrumentation-grpc": { enabled: true },
    "@opentelemetry/instrumentation-hapi": { enabled: false },
    "@opentelemetry/instrumentation-http": { enabled: true },
    "@opentelemetry/instrumentation-ioredis": { enabled: true },
    "@opentelemetry/instrumentation-kafkajs": { enabled: true },
    "@opentelemetry/instrumentation-knex": { enabled: true },
    "@opentelemetry/instrumentation-koa": { enabled: true, ignoreLayersType: [KoaLayerType.MIDDLEWARE] },
    "@opentelemetry/instrumentation-lru-memoizer": { enabled: false },
    "@opentelemetry/instrumentation-memcached": { enabled: false },
    "@opentelemetry/instrumentation-mongodb": { enabled: false },
    "@opentelemetry/instrumentation-mongoose": { enabled: false },
    "@opentelemetry/instrumentation-mysql2": { enabled: false },
    "@opentelemetry/instrumentation-mysql": { enabled: false },
    "@opentelemetry/instrumentation-nestjs-core": { enabled: false },
    "@opentelemetry/instrumentation-net": { enabled: false },
    "@opentelemetry/instrumentation-openai": { enabled: false },
    "@opentelemetry/instrumentation-oracledb": { enabled: false },
    "@opentelemetry/instrumentation-pg": { enabled: true },
    "@opentelemetry/instrumentation-pino": { enabled: false },
    "@opentelemetry/instrumentation-redis": { enabled: true },
    "@opentelemetry/instrumentation-restify": { enabled: false },
    "@opentelemetry/instrumentation-router": { enabled: false },
    "@opentelemetry/instrumentation-runtime-node": { enabled: false },
    "@opentelemetry/instrumentation-socket.io": { enabled: true },
    "@opentelemetry/instrumentation-tedious": { enabled: false },
    "@opentelemetry/instrumentation-undici": { enabled: false },
    "@opentelemetry/instrumentation-winston": { enabled: false }
};

// This registers all instrumentation packages
registerInstrumentations({
    instrumentations: [
        getNodeAutoInstrumentations(instrumentationConfig)
    ]
});

const env = ConfigurationManager.requireStringConfig("env");
const isDev = env === "dev";

const resource =
    defaultResource().merge(
        resourceFromAttributes({
            // [SemanticResourceAttributes.SERVICE_NAME]: ConfigurationManager.getConfig("package.name"),
            // [SemanticResourceAttributes.SERVICE_VERSION]: ConfigurationManager.getConfig("package.version"),
            // [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env

            [ATTR_SERVICE_NAME]: ConfigurationManager.getConfig("package_name") ?? ConfigurationManager.getConfig("package.name") ?? undefined,
            [ATTR_SERVICE_VERSION]: ConfigurationManager.getConfig("package.version") ?? undefined
        })
    );

const samplingRate = TypeHelper.parseNumber(ConfigurationManager.getConfig("otelTraceSamplingRate")) ?? 1;

const enableXrayTracing = TypeHelper.parseBoolean(ConfigurationManager.getConfig("enableXrayTracing")) ?? false;

const tracerConfig: TracerConfig = {
    resource: resource,
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(samplingRate) })
};

if (enableXrayTracing)
    tracerConfig.idGenerator = new AWSXRayIdGenerator();

let traceHost = ConfigurationManager.getConfig<string | null>("otelTraceHost");
if (traceHost == null || typeof traceHost !== "string" || traceHost.isEmptyOrWhiteSpace())
    traceHost = isDev ? "localhost" : "0.0.0.0";

// const exporter = new ConsoleSpanExporter();
const exporter = new OTLPTraceExporter({
    // optional - default url is http://localhost:4318/v1/traces

    url: `http://${traceHost}:4318/v1/traces`,
    // optional - collection of custom headers to be sent with each request, empty by default
    headers: {}
});
const processor = new BatchSpanProcessor(exporter);

// Span processors are now supplied via the constructor (addSpanProcessor was removed in the OTel SDK 2.x line).
const provider = new NodeTracerProvider({
    ...tracerConfig,
    spanProcessors: [processor]
});

provider.register(enableXrayTracing ? { propagator: new AWSXRayPropagator() } : undefined);
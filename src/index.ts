import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { NodeTracerProvider, ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-node";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { BatchSpanProcessor, TracerConfig } from "@opentelemetry/sdk-trace-base";
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ConfigurationManager } from "@nivinjoseph/n-config";
import { KoaLayerType } from "@opentelemetry/instrumentation-koa";
import { TypeHelper } from "@nivinjoseph/n-util";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { AWSXRayIdGenerator } from "@opentelemetry/id-generator-aws-xray";

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// This registers all instrumentation packages
registerInstrumentations({
    instrumentations: [
        getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-http": undefined,
            "@opentelemetry/instrumentation-grpc": undefined,
            "@opentelemetry/instrumentation-redis": undefined,
            "@opentelemetry/instrumentation-ioredis": undefined,
            "@opentelemetry/instrumentation-pg": undefined,
            "@opentelemetry/instrumentation-knex": undefined,
            "@opentelemetry/instrumentation-koa": { ignoreLayersType: [KoaLayerType.MIDDLEWARE] },
            "@opentelemetry/instrumentation-aws-sdk": undefined,
            "@opentelemetry/instrumentation-aws-lambda": undefined
        })
    ]
});

const env = ConfigurationManager.getConfig<string>("env");
const isDev = env === "dev";

const resource =
    Resource.default().merge(
        new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: ConfigurationManager.getConfig("package.name"),
            [SemanticResourceAttributes.SERVICE_VERSION]: ConfigurationManager.getConfig("package.version"),
            [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env
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
    
const provider = new NodeTracerProvider();
// const exporter = new ConsoleSpanExporter();
const exporter = new OTLPTraceExporter({
    // optional - default url is http://localhost:4318/v1/traces

    url: `http://${traceHost}:4318/v1/traces`,
    // optional - collection of custom headers to be sent with each request, empty by default
    headers: {}
});
const processor = new BatchSpanProcessor(exporter);
provider.addSpanProcessor(processor);

provider.register(enableXrayTracing ? { propagator: new AWSXRayPropagator() } : undefined);
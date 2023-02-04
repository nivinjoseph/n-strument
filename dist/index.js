"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const api_1 = require("@opentelemetry/api");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const n_config_1 = require("@nivinjoseph/n-config");
const instrumentation_koa_1 = require("@opentelemetry/instrumentation-koa");
const n_util_1 = require("@nivinjoseph/n-util");
const propagator_aws_xray_1 = require("@opentelemetry/propagator-aws-xray");
const id_generator_aws_xray_1 = require("@opentelemetry/id-generator-aws-xray");
// For troubleshooting, set the log level to DiagLogLevel.DEBUG
api_1.diag.setLogger(new api_1.DiagConsoleLogger(), api_1.DiagLogLevel.INFO);
// This registers all instrumentation packages
(0, instrumentation_1.registerInstrumentations)({
    instrumentations: [
        (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
            "@opentelemetry/instrumentation-http": undefined,
            "@opentelemetry/instrumentation-grpc": undefined,
            "@opentelemetry/instrumentation-redis": undefined,
            "@opentelemetry/instrumentation-ioredis": undefined,
            "@opentelemetry/instrumentation-pg": undefined,
            "@opentelemetry/instrumentation-knex": undefined,
            "@opentelemetry/instrumentation-koa": { ignoreLayersType: [instrumentation_koa_1.KoaLayerType.MIDDLEWARE] },
            "@opentelemetry/instrumentation-aws-sdk": undefined,
            "@opentelemetry/instrumentation-aws-lambda": undefined
        })
    ]
});
const env = n_config_1.ConfigurationManager.getConfig("env");
const isDev = env === "dev";
const resource = resources_1.Resource.default().merge(new resources_1.Resource({
    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: n_config_1.ConfigurationManager.getConfig("package.name"),
    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: n_config_1.ConfigurationManager.getConfig("package.version"),
    [semantic_conventions_1.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env
}));
const samplingRate = (_a = n_util_1.TypeHelper.parseNumber(n_config_1.ConfigurationManager.getConfig("otelTraceSamplingRate"))) !== null && _a !== void 0 ? _a : 1;
const enableXrayTracing = (_b = n_util_1.TypeHelper.parseBoolean(n_config_1.ConfigurationManager.getConfig("enableXrayTracing"))) !== null && _b !== void 0 ? _b : false;
const tracerConfig = {
    resource: resource,
    sampler: new sdk_trace_node_1.ParentBasedSampler({ root: new sdk_trace_node_1.TraceIdRatioBasedSampler(samplingRate) })
};
if (enableXrayTracing)
    tracerConfig.idGenerator = new id_generator_aws_xray_1.AWSXRayIdGenerator();
let traceHost = n_config_1.ConfigurationManager.getConfig("otelTraceHost");
if (traceHost == null || typeof traceHost !== "string" || traceHost.isEmptyOrWhiteSpace())
    traceHost = isDev ? "localhost" : "0.0.0.0";
const provider = new sdk_trace_node_1.NodeTracerProvider();
// const exporter = new ConsoleSpanExporter();
const exporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
    // optional - default url is http://localhost:4318/v1/traces
    url: `http://${traceHost}:4318/v1/traces`,
    // optional - collection of custom headers to be sent with each request, empty by default
    headers: {}
});
const processor = new sdk_trace_base_1.BatchSpanProcessor(exporter);
provider.addSpanProcessor(processor);
provider.register(enableXrayTracing ? { propagator: new propagator_aws_xray_1.AWSXRayPropagator() } : undefined);
//# sourceMappingURL=index.js.map
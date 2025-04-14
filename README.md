# n-strument

A TypeScript-based instrumentation helper library that simplifies the setup and configuration of OpenTelemetry instrumentation in Node.js applications.

## Features

- Automatic instrumentation for popular Node.js libraries and frameworks
- Configurable sampling rates
- Support for AWS X-Ray tracing
- Batch span processing
- Flexible configuration through environment variables
- Built-in support for various instrumentations including HTTP, gRPC, Redis, PostgreSQL, Koa, and AWS services

## Installation

```bash
yarn add @nivinjoseph/n-strument
```

or

```bash
npm install @nivinjoseph/n-strument
```

## Configuration

The library uses environment variables for configuration. Here are the available options:

- `env`: Environment name (required)
- `package_name` or `package.name`: Service name for tracing
- `package.version`: Service version for tracing
- `otelTraceSamplingRate`: Sampling rate for traces (default: 1)
- `enableXrayTracing`: Enable AWS X-Ray tracing format (default: false)
- `otelTraceHost`: Host for the OpenTelemetry collector (default: "localhost" in dev, "0.0.0.0" in other environments)

## Supported Instrumentations

- HTTP
- gRPC
- Redis/IORedis
- PostgreSQL
- Knex
- Koa (with middleware layer filtering)
- AWS SDK
- AWS Lambda

## Usage

The library automatically sets up OpenTelemetry instrumentation when imported. Example usage:

```typescript
import "@nivinjoseph/n-strument";

// Your application code here
// Tracing will be automatically enabled for supported libraries
```

## Development

### Scripts

- `yarn ts-build`: Compile TypeScript and run linting
- `yarn test`: Run tests
- `yarn publish-package`: Build, commit, version bump, and publish to npm

## Contributing

Issues and pull requests are welcome at https://github.com/nivinjoseph/n-strument

## Dependencies

- OpenTelemetry SDK and instrumentations
- @nivinjoseph/n-config
- @nivinjoseph/n-util
- AWS X-Ray propagator and ID generator


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


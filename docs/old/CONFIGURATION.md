# Configuration Guide

This guide explains how to configure the Universal Data Layer core package using custom configuration files to override default settings.

## Overview

The Universal Data Layer supports flexible configuration through multiple sources, allowing you to customize the server behavior based on your needs. Configuration can be provided through:

1. **Configuration files** (recommended for project-specific settings)
2. **Command-line arguments** (useful for temporary overrides)
3. **Default values** (fallback when no custom config is provided)

## Configuration Priority

Settings are applied in the following priority order (highest to lowest):

1. Command-line arguments
2. Configuration file (`udl.config.js`, `udl.config.mjs`, or `udl.config.cjs`)
3. Environment variables (for PORT)
4. Built-in defaults

## Creating a Configuration File

### Supported Formats

The core package looks for configuration files in your project root directory in the following order:

1. `udl.config.js` - ES module format (recommended)
2. `udl.config.mjs` - Explicit ES module format
3. `udl.config.cjs` - CommonJS format

### Configuration Options

| Property   | Type   | Default                         | Description               |
| ---------- | ------ | ------------------------------- | ------------------------- |
| `port`     | number | 4000                            | Server port number        |
| `host`     | string | 'localhost'                     | Server host address       |
| `endpoint` | string | 'http://localhost:4000/graphql' | Full GraphQL endpoint URL |

### Example Configurations

#### ES Module Format (`udl.config.js` or `udl.config.mjs`)

```javascript
export default {
  port: 8080,
  host: '0.0.0.0',
  endpoint: 'https://api.example.com/graphql',
};
```

#### CommonJS Format (`udl.config.cjs`)

```javascript
module.exports = {
  port: 3000,
  host: 'localhost',
  endpoint: 'http://localhost:3000/graphql',
};
```

#### Partial Configuration

You can specify only the settings you want to override. Unspecified settings will use defaults:

```javascript
export default {
  port: 5000,
  // host and endpoint will use default values
};
```

## Usage Examples

### Basic Setup

1. Create a configuration file in your project root:

```javascript
// udl.config.js
export default {
  port: 8080,
  host: '0.0.0.0',
};
```

2. Run the server:

```bash
npx universal-data-layer
```

The server will start on port 8080 and be accessible from any network interface.

### Development vs Production

You can use different configuration files for different environments:

```javascript
// udl.config.js
const isDevelopment = process.env.NODE_ENV !== 'production';

export default {
  port: isDevelopment ? 3000 : 8080,
  host: isDevelopment ? 'localhost' : '0.0.0.0',
  endpoint: isDevelopment
    ? 'http://localhost:3000/graphql'
    : 'https://api.production.com/graphql',
};
```

### Dynamic Configuration

Configuration files support dynamic values:

```javascript
// udl.config.js
export default {
  port: parseInt(process.env.PORT) || 4000,
  host: process.env.HOST || 'localhost',
  endpoint: process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
};
```

### Command-line Override

You can override configuration file settings using CLI arguments:

```bash
# Override port from config file
npx universal-data-layer --port 9000
```

## Advanced Configuration

### Async Configuration

Configuration files can export async functions for dynamic setup:

```javascript
// udl.config.js
export default async () => {
  // Fetch configuration from external source
  const remoteConfig = await fetchConfigFromAPI();

  return {
    port: remoteConfig.port || 4000,
    host: remoteConfig.host || 'localhost',
    endpoint: remoteConfig.endpoint,
  };
};
```

### Environment-based Configuration

Use environment variables for sensitive or deployment-specific settings:

```javascript
// udl.config.js
export default {
  port: process.env.UDL_PORT ? parseInt(process.env.UDL_PORT) : 4000,
  host: process.env.UDL_HOST || 'localhost',
  endpoint: process.env.UDL_ENDPOINT || 'http://localhost:4000/graphql',
};
```

## Configuration Loading Process

When the server starts, it follows this process:

1. **Search for config file**: Looks for `udl.config.js`, `udl.config.mjs`, or `udl.config.cjs` in the current working directory
2. **Load configuration**: Dynamically imports the first matching file found
3. **Apply CLI overrides**: Command-line arguments take precedence over file settings
4. **Apply defaults**: Any unspecified settings use built-in defaults
5. **Initialize server**: Starts the server with the merged configuration

## Error Handling

### Missing Configuration File

If no configuration file is found, the server will start with default settings. This is not an error condition.

### Invalid Configuration

If your configuration file has syntax errors or exports invalid values, you'll see a warning:

```
Warning: Failed to load config from /path/to/udl.config.js
[Error details]
```

The server will continue with default settings when config loading fails.

### Type Validation

The configuration system expects specific types for each property:

```javascript
// ✅ Correct
export default {
  port: 8080,              // number
  host: '0.0.0.0',        // string
  endpoint: 'http://...'  // string
};

// ❌ Incorrect - will be ignored
export default {
  port: '8080',           // string instead of number
  host: 123,              // number instead of string
};
```

## Best Practices

1. **Use version control**: Commit your `udl.config.js` file to share configuration across your team
2. **Environment separation**: Use environment variables or separate config files for different deployments
3. **Keep it simple**: Only override settings you need to change
4. **Document custom settings**: Add comments explaining why specific values were chosen
5. **Validate at startup**: Add validation logic in your config file if needed

```javascript
// udl.config.js with validation
const config = {
  port: parseInt(process.env.PORT) || 4000,
  host: process.env.HOST || 'localhost',
};

// Validate port range
if (config.port < 1024 || config.port > 65535) {
  throw new Error(
    `Invalid port: ${config.port}. Must be between 1024 and 65535.`
  );
}

export default config;
```

## Troubleshooting

### Config file not being loaded

Ensure your config file:

- Is in the project root directory (where you run `npx universal-data-layer`)
- Has the correct name (`udl.config.js`, `udl.config.mjs`, or `udl.config.cjs`)
- Exports a default object or function
- Has valid JavaScript syntax

### Port already in use

If the configured port is already in use, you'll see an error. Either:

- Change the port in your config file
- Use CLI override: `npx universal-data-layer --port 5000`
- Stop the process using the port

### Configuration not taking effect

Check the priority order:

1. CLI arguments always win
2. Config file values override defaults
3. Ensure you're editing the correct config file
4. Restart the server after config changes

## Related Documentation

- [API Documentation](./API.md) - Complete API reference
- [Getting Started](../README.md) - Quick start guide
- [Core Package Documentation](../packages/core/README.md) - Core package details

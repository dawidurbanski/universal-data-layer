---
'universal-data-layer': patch
---

Add UDL_ENDPOINT environment variable support to config

The `getConfig()` function now checks for the `UDL_ENDPOINT` environment variable when config hasn't been explicitly initialized. This allows the `udl.query()` client to automatically use the correct endpoint in child processes.

**Features:**

- `UDL_ENDPOINT_ENV` constant for the environment variable name
- `DEFAULT_UDL_PORT` constant (4000) for consistent default port
- `isConfigInitialized()` to check if config was explicitly set
- `resetConfig()` for testing isolation

**How it works:**

When `getConfig()` is called and no config was explicitly set via `createConfig()`, it checks for the `UDL_ENDPOINT` environment variable and uses that endpoint if present.

This enables scenarios like:

- Next.js adapter sets `UDL_ENDPOINT` when spawning Next.js
- `udl.query()` in Next.js code automatically uses the right endpoint

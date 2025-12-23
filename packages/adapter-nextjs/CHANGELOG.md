# @universal-data-layer/adapter-nextjs

## 2.0.0

### Minor Changes

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add config file support and UDL_ENDPOINT injection for Next.js adapter

  The adapter commands now read the UDL port from `udl.config.ts` and automatically inject the `UDL_ENDPOINT` environment variable when spawning Next.js processes.

  **Features:**
  - `dev`, `build`, and `start` commands read port from config file
  - Port priority: CLI option > config file > default (4000)
  - Next.js processes receive `UDL_ENDPOINT` env var automatically
  - Supports `udl.config.ts`, `udl.config.js`, and `udl.config.mjs`

  **Benefits:**
  - No need to manually set `UDL_ENDPOINT` in environment
  - `udl.query()` client automatically uses the correct endpoint
  - Consistent port configuration between UDL server and Next.js

  **Example:**

  ```typescript
  // udl.config.ts
  export const { config } = defineConfig({
    port: 5000, // Adapter commands will use this port
  });
  ```

  ```typescript
  // In Next.js code, udl.query() automatically uses the right endpoint
  const result = await udl.query(GetProducts);
  ```

### Patch Changes

- [#70](https://github.com/dawidurbanski/universal-data-layer/pull/70) [`6fe6408`](https://github.com/dawidurbanski/universal-data-layer/commit/6fe6408bca8f0924670c989318a3564b52257660) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - refactor: remove hardcoded default port values

  Removed hardcoded default port (4000) from CLI and adapter commands. The port is now only passed when explicitly specified by the user, allowing the config file to determine the default port value instead.

- Updated dependencies [[`dfc7d90`](https://github.com/dawidurbanski/universal-data-layer/commit/dfc7d9054b761b951995dc5ceba467c2aa560d1a), [`6430a55`](https://github.com/dawidurbanski/universal-data-layer/commit/6430a55a4f1054fd0397f8ec1e21cf6a4e359e81), [`b376bed`](https://github.com/dawidurbanski/universal-data-layer/commit/b376bed4ad8398de74dcbc4fa05a960412f820af), [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949), [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949), [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b), [`aba060e`](https://github.com/dawidurbanski/universal-data-layer/commit/aba060e79217bd4c2bca8b8a56c7835296c74c02), [`8ec4f2b`](https://github.com/dawidurbanski/universal-data-layer/commit/8ec4f2b4f20825e597c52f1420b7f61a63264d02), [`5ff7110`](https://github.com/dawidurbanski/universal-data-layer/commit/5ff7110e4e80e0c6d84d7924b078200e69d07949), [`6ffae50`](https://github.com/dawidurbanski/universal-data-layer/commit/6ffae500b103c2a59b68c79bff01d11ac6fce5ef), [`051192e`](https://github.com/dawidurbanski/universal-data-layer/commit/051192e17361e0cb9661ce86ee46f938d88b96b6), [`6fe6408`](https://github.com/dawidurbanski/universal-data-layer/commit/6fe6408bca8f0924670c989318a3564b52257660), [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b), [`0ea71da`](https://github.com/dawidurbanski/universal-data-layer/commit/0ea71da18234161ce8a09fdefcbae8731d7dba8c), [`5920046`](https://github.com/dawidurbanski/universal-data-layer/commit/59200465efa9600155f8047157a674303912d547), [`2e01999`](https://github.com/dawidurbanski/universal-data-layer/commit/2e0199904518814cd899385ec29dbf8b002cb06b)]:
  - universal-data-layer@2.0.0

## 1.0.6

### Patch Changes

- [#55](https://github.com/dawidurbanski/universal-data-layer/pull/55) [`22710e3`](https://github.com/dawidurbanski/universal-data-layer/commit/22710e3ecc0ba5d0ca4afe86b51d524597e4ebdc) Thanks [@dawidurbanski](https://github.com/dawidurbanski)! - Add Next.js adapter package with unified CLI

  Introduces `@universal-data-layer/adapter-nextjs`, a framework adapter that provides a unified CLI (`udl-next`) for running Universal Data Layer alongside Next.js applications.

  **Features:**
  - `udl-next dev` - Runs UDL and Next.js development servers concurrently
  - `udl-next build` - Sequential build: starts UDL server, runs codegen, then builds Next.js
  - `udl-next start` - Runs UDL and Next.js production servers concurrently

  **Highlights:**
  - Prefixed console output (`[udl]`, `[next]`, `[codegen]`) for easy debugging
  - Graceful shutdown handling for SIGINT/SIGTERM signals
  - Configurable ports via `--port` and `--next-port` options
  - Pass-through arguments to Next.js using `--` separator
  - Programmatic API for custom integrations

- Updated dependencies [[`4ea4d39`](https://github.com/dawidurbanski/universal-data-layer/commit/4ea4d39fecfe5304d6d830ed0d9fc20ea35fafdf)]:
  - universal-data-layer@1.0.6

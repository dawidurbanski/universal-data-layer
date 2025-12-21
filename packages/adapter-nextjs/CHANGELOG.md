# @universal-data-layer/adapter-nextjs

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

---
'@universal-data-layer/adapter-nextjs': patch
---

Add Next.js adapter package with unified CLI

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

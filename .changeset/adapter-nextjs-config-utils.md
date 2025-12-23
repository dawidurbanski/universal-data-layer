---
'@universal-data-layer/adapter-nextjs': minor
---

Add config file support and UDL_ENDPOINT injection for Next.js adapter

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

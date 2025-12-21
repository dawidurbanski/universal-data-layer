# @universal-data-layer/adapter-nextjs

Next.js adapter for Universal Data Layer. Provides a unified CLI (`udl-next`) that runs UDL and Next.js together with prefixed output, graceful shutdown, and proper process lifecycle management.

## Installation

```bash
npm install @universal-data-layer/adapter-nextjs
```

## Usage

Replace your Next.js scripts with the unified `udl-next` CLI:

```json
{
  "scripts": {
    "dev": "udl-next dev",
    "build": "udl-next build",
    "start": "udl-next start"
  }
}
```

## Commands

### `udl-next dev`

Runs UDL and Next.js development servers concurrently.

```bash
udl-next dev                    # Run with default ports
udl-next dev --port 5000        # Custom UDL port
udl-next dev --next-port 3001   # Custom Next.js port
udl-next dev -- --turbo         # Pass args to Next.js
```

### `udl-next build`

Runs the build process sequentially:

1. Starts UDL server
2. Waits for server to be ready
3. Runs `udl-codegen` to generate types
4. Runs `next build`
5. Cleans up

```bash
udl-next build                  # Build with defaults
udl-next build --port 5000      # Custom UDL port during build
udl-next build -- --debug       # Pass args to next build
```

### `udl-next start`

Runs UDL and Next.js production servers concurrently.

```bash
udl-next start                  # Run with default ports
udl-next start --port 5000      # Custom UDL port
udl-next start --next-port 3001 # Custom Next.js port
```

## CLI Options

| Option        | Short | Default | Description         |
| ------------- | ----- | ------- | ------------------- |
| `--port`      | `-p`  | `4000`  | UDL server port     |
| `--next-port` |       | `3000`  | Next.js server port |
| `--help`      | `-h`  |         | Show help message   |

### Passing Arguments to Next.js

Use `--` to pass additional arguments to the underlying Next.js command:

```bash
udl-next dev -- --turbo --experimental-https
udl-next build -- --debug
udl-next start -- --keepAliveTimeout 5000
```

## Output Prefixes

Console output is prefixed to identify which process generated it:

- `[udl]` - Output from Universal Data Layer (cyan)
- `[next]` - Output from Next.js (magenta)
- `[codegen]` - Output from codegen during build (cyan)

Example output:

```
[udl] Server running at http://localhost:4000
[udl] GraphQL endpoint: http://localhost:4000/graphql
[next] ready - started server on 0.0.0.0:3000
[next] ✓ Compiled successfully
```

## Signal Handling

The adapter handles graceful shutdown:

- **Ctrl+C (SIGINT)**: Gracefully stops both processes
- **SIGTERM**: Gracefully stops both processes
- **Child exit**: If either process exits unexpectedly, the other is terminated

## Programmatic Usage

The adapter can also be used programmatically:

```typescript
import {
  runDev,
  runBuild,
  runStart,
  parseArgs,
} from '@universal-data-layer/adapter-nextjs';

// Run dev servers
await runDev({ port: 4000, nextPort: 3000 }, ['--turbo']);

// Run build
await runBuild({ port: 4000 }, []);

// Parse CLI arguments
const { command, options, nextArgs } = parseArgs(process.argv.slice(2));
```

## Troubleshooting

### Port already in use

If you see an error about a port being in use, specify different ports:

```bash
udl-next dev --port 4001 --next-port 3001
```

### Build fails during codegen

Ensure your `udl.config.ts` is valid and all required environment variables are set. The build process starts the UDL server before running codegen.

### Processes not stopping

If processes don't stop cleanly, you may need to manually kill them:

```bash
# Find and kill processes on the ports
lsof -ti:4000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

## Requirements

- Node.js 18+
- `universal-data-layer` peer dependency
- `next` peer dependency (14+)

## License

MIT

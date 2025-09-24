# Universal Data Layer - Core

The core package of the Universal Data Layer project - a modular, high-performance intermediate data layer that acts as a unified interface between applications and multiple data sources.

## Installation

```bash
npm install universal-data-layer
```

## Quick Start

### Using npx (no installation required)

```bash
# Start server with default settings
npx universal-data-layer

# Start server on custom port
npx universal-data-layer --port 8080

# Show help
npx universal-data-layer --help
```

### After installation

```bash
# If installed globally
universal-data-layer

# If installed locally in a project
npx universal-data-layer
```

### Programmatic usage

```javascript
import server from 'universal-data-layer';

// Start the server
server.listen(4000);
console.log('Server running on port 4000');
```

## CLI Options

- `-p, --port <port>` - Port to run the server on (default: 4000)
- `-h, --help` - Show help message

## Server Endpoints

Once running, the server provides:

- **GraphQL API**: `http://localhost:<port>/graphql`
- **GraphiQL Interface**: `http://localhost:<port>/graphiql`

## GraphQL Schema

The current schema provides:

```graphql
type Query {
  version: String
}
```

Example query:

```bash
curl http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ version }"}'
```

## Development

### Building from source

```bash
npm run build
```

### Development mode with auto-reload

```bash
npm run dev
```

### Starting the compiled server

```bash
npm start
```

## Architecture

The core package provides:

- GraphQL server with HTTP interface
- GraphiQL development interface
- Plugin-ready architecture for data sources
- Type-safe TypeScript implementation

## Environment Variables

- `PORT` - Server port (used when running directly via `npm start`)

## Project Status

This is the core foundation of the Universal Data Layer project. Current features:

- Basic GraphQL server setup
- CLI interface for easy deployment
- GraphiQL for development

Upcoming features:

- Plugin system for data sources
- Caching layer
- Data transformation pipeline
- Framework-specific adapters

## License

MIT

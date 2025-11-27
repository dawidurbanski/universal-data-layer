# @udl/codegen

Type-safe code generation for Universal Data Layer. Generate TypeScript types, type guards, and fetch helpers from your data schemas.

## Features

- **TypeScript Types**: Generate interfaces from content type definitions
- **Type Guards**: Generate `is{Type}` and `assert{Type}` functions
- **Fetch Helpers**: Generate GraphQL query functions for each type
- **Schema Inference**: Infer schemas from NodeStore, GraphQL introspection, or REST responses
- **Flexible Output**: Single-file or multi-file output modes
- **Incremental Builds**: Skip unchanged files for faster regeneration

## Installation

```bash
npm install @udl/codegen
```

## CLI Usage

```bash
# Generate types from a config file
npx udl-codegen generate

# Specify output directory
npx udl-codegen generate --output ./src/generated

# Include type guards and fetch helpers
npx udl-codegen generate --guards --helpers

# Preview without writing files
npx udl-codegen generate --dry-run

# Use custom config file
npx udl-codegen generate --config ./codegen.config.ts
```

### CLI Options

| Option            | Description                               |
| ----------------- | ----------------------------------------- |
| `--output, -o`    | Output directory (default: `./generated`) |
| `--guards`        | Generate type guard functions             |
| `--helpers`       | Generate fetch helper functions           |
| `--single-file`   | Output all code to a single file          |
| `--dry-run`       | Preview output without writing files      |
| `--config, -c`    | Path to config file                       |
| `--endpoint`      | GraphQL endpoint for fetch helpers        |
| `--include-jsdoc` | Include JSDoc comments                    |
| `--help, -h`      | Show help                                 |

## Configuration

Create a `codegen.config.ts` file:

```typescript
import type { CodegenConfig } from '@udl/codegen';

export default {
  output: './src/generated',
  guards: true,
  helpers: true,
  singleFile: false,
  endpoint: 'http://localhost:4000/graphql',
  includeJsDoc: true,
  schemas: [
    {
      name: 'Product',
      description: 'A product in the catalog',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'price', type: 'number', required: true },
        { name: 'description', type: 'string', required: false },
      ],
      indexes: ['name'],
    },
  ],
} satisfies CodegenConfig;
```

## Programmatic API

### Schema Registry

```typescript
import { SchemaRegistry } from '@udl/codegen';

const registry = new SchemaRegistry();

// Register a type
registry.register({
  name: 'Product',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'price', type: 'number', required: true },
  ],
});

// Extend an existing type
registry.extend('Product', [
  { name: 'category', type: 'reference', referenceType: 'Category' },
]);

// Get all schemas
const schemas = registry.getAll();
```

### Schema Inference

```typescript
import {
  inferSchemaFromStore,
  inferSchemaFromResponse,
  inferSchemaFromGraphQL,
} from '@udl/codegen';

// From NodeStore
const schemas = inferSchemaFromStore(nodeStore);

// From REST response
const schema = inferSchemaFromResponse(jsonResponse, 'Product');

// From GraphQL introspection
const schemas = await inferSchemaFromGraphQL('http://localhost:4000/graphql');
```

### Code Generation

```typescript
import {
  TypeScriptGenerator,
  TypeGuardGenerator,
  FetchHelperGenerator,
} from '@udl/codegen';

// Generate TypeScript interfaces
const tsGenerator = new TypeScriptGenerator({ includeJsDoc: true });
const typesCode = tsGenerator.generate(schemas);

// Generate type guards
const guardGenerator = new TypeGuardGenerator({ deepCheck: true });
const guardsCode = guardGenerator.generate(schemas);

// Generate fetch helpers
const fetchGenerator = new FetchHelperGenerator({
  endpoint: 'http://localhost:4000/graphql',
});
const helpersCode = fetchGenerator.generate(schemas);
```

### File Output

```typescript
import { FileWriter } from '@udl/codegen';

// Multi-file output
const writer = new FileWriter({
  output: './src/generated',
  mode: 'multi',
  incrementalWrite: true,
});

const result = writer.writeAll({
  types: { schemas, code: typesCode },
  guards: { schemas, code: guardsCode },
  helpers: { schemas, code: helpersCode },
});

console.log('Written:', result.written);
console.log('Skipped:', result.skipped);
```

## Schema Definition

### Field Types

| Type        | TypeScript Output                        |
| ----------- | ---------------------------------------- |
| `string`    | `string`                                 |
| `number`    | `number`                                 |
| `boolean`   | `boolean`                                |
| `null`      | `null`                                   |
| `unknown`   | `unknown`                                |
| `array`     | `T[]` (with `arrayItemType`)             |
| `object`    | Inline object type (with `objectFields`) |
| `reference` | Reference type (with `referenceType`)    |

### Example Schema

```typescript
const schema: ContentTypeDefinition = {
  name: 'BlogPost',
  description: 'A blog post',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'content', type: 'string', required: true },
    { name: 'publishedAt', type: 'string', required: false },
    { name: 'views', type: 'number', required: true },
    {
      name: 'tags',
      type: 'array',
      required: true,
      arrayItemType: { name: 'tag', type: 'string', required: true },
    },
    {
      name: 'author',
      type: 'object',
      required: true,
      objectFields: [
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
      ],
    },
    {
      name: 'category',
      type: 'reference',
      required: false,
      referenceType: 'Category',
    },
  ],
  indexes: ['title'],
};
```

## Generated Output Examples

### TypeScript Types

```typescript
export interface BlogPost extends Node {
  title: string;
  content: string;
  publishedAt?: string;
  views: number;
  tags: string[];
  author: {
    name: string;
    email: string;
  };
  category?: Category;
}
```

### Type Guards

```typescript
export function isBlogPost(value: unknown): value is BlogPost {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.title !== 'string') return false;
  if (typeof obj.content !== 'string') return false;
  // ... more checks
  return true;
}

export function assertBlogPost(value: unknown): asserts value is BlogPost {
  if (!isBlogPost(value)) {
    throw new TypeError('Value is not a valid BlogPost');
  }
}
```

### Fetch Helpers

```typescript
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query { allBlogPost { id title content ... } }`,
    }),
  });
  const json = await response.json();
  return json.data.allBlogPost;
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  // ...
}

export async function getBlogPostByTitle(
  title: string
): Promise<BlogPost | null> {
  // ...
}
```

## Plugin Integration

Use the `registerTypes` hook in your UDL plugins to register schemas for code generation:

```typescript
// udl.config.ts
export default defineConfig({
  plugins: [
    {
      name: 'my-plugin',
      registerTypes({ registerType, extendType }) {
        registerType({
          name: 'Product',
          fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'price', type: 'number', required: true },
          ],
        });
      },
    },
  ],
});
```

## License

MIT

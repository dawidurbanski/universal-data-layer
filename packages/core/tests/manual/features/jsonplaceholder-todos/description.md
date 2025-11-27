# JSONPlaceholder Todos Demo

This manual test demonstrates the complete UDL workflow: fetching data from an external REST API, sourcing it as nodes, and **automatically generating** TypeScript types with `@udl/codegen`.

## What This Tests

1. **Data Sourcing** - Fetching todos from JSONPlaceholder REST API
2. **Node Creation** - Creating typed nodes in the UDL store
3. **GraphQL Schema** - Auto-generated schema from sourced nodes with filter support
4. **Automatic Code Generation** - Types, guards, and helpers generated on server start

## The Plugin

### Todo Source Plugin (`plugins/todo-source/udl.config.ts`)

Fetches todo items from `https://jsonplaceholder.typicode.com/todos` and creates UDL nodes:

```typescript
export async function sourceNodes({
  actions,
  createNodeId,
  createContentDigest,
}) {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos');
  const todos = await response.json();

  for (const todo of todos.slice(0, 20)) {
    await actions.createNode({
      internal: {
        id: createNodeId('Todo', String(todo.id)),
        type: 'Todo',
        owner: 'jsonplaceholder-todo-source',
        contentDigest: createContentDigest(todo),
      },
      externalId: todo.id,
      userId: todo.userId,
      title: todo.title,
      completed: todo.completed,
    });
  }
}
```

## Automatic Code Generation

### Configuration (`udl.config.ts`)

Enable automatic code generation by adding the `codegen` option to your config:

```typescript
import type { UDLConfig } from 'universal-data-layer';

export const config: UDLConfig = {
  plugins: [
    {
      name: './plugins/todo-source',
      options: {
        indexes: ['userId'], // Enable userId indexing
      },
    },
  ],
  // Automatically generate types, guards, and helpers after sourceNodes
  codegen: {
    output: './generated',
    guards: true, // Generate isTodo(), assertTodo()
    helpers: true, // Generate getAllTodos(), getTodoById()
  },
};
```

### What Gets Generated

When you run `npm run dev`, the server automatically:

1. Loads plugins and runs `sourceNodes`
2. Builds the GraphQL schema
3. **Generates TypeScript code** to `./generated/`

```
./generated/
├── index.ts           # Re-exports everything
├── types/
│   └── index.ts       # interface Todo extends Node { ... }
├── guards/
│   └── index.ts       # isTodo(), assertTodo()
└── helpers/
    └── index.ts       # getAllTodos(), getTodoById()
```

### Using Generated Code

```typescript
import { Todo, isTodo, getAllTodos } from './generated';

// Fetch all todos with generated helper
const todos = await getAllTodos();

// Validate data at runtime with generated guard
for (const todo of todos) {
  if (isTodo(todo)) {
    console.log(`${todo.title}: ${todo.completed ? 'Done' : 'Pending'}`);
  }
}
```

## Alternative: CLI-Based Generation

You can also generate code manually using the CLI:

```bash
# Generate types only
npx udl-codegen --endpoint http://localhost:4000/graphql -o ./generated

# Generate types + type guards
npx udl-codegen --endpoint http://localhost:4000/graphql --guards -o ./generated

# Generate types + type guards + fetch helpers
npx udl-codegen --endpoint http://localhost:4000/graphql --guards --helpers -o ./generated

# Preview what would be generated (dry run)
npx udl-codegen --endpoint http://localhost:4000/graphql --guards --helpers --dry-run
```

## GraphQL Queries

With the server running, you can query directly with filter support:

```graphql
# Get all todos
{
  allTodo {
    externalId
    userId
    title
    completed
  }
}

# Filter by user ID
{
  allTodo(filter: { userId: { eq: 1 } }) {
    title
    completed
  }
}

# Filter by completion status
{
  allTodo(filter: { completed: { eq: true } }) {
    title
    userId
  }
}

# Filter by title containing text
{
  allTodo(filter: { title: { contains: "laboriosam" } }) {
    title
    userId
    completed
  }
}
```

### Available Filter Operators

| Type      | Operators                                              |
| --------- | ------------------------------------------------------ |
| String    | `eq`, `ne`, `in`, `contains`, `startsWith`, `endsWith` |
| Int/Float | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`             |
| Boolean   | `eq`, `ne`                                             |

## Data Flow

```
JSONPlaceholder API (https://jsonplaceholder.typicode.com/todos)
    ↓ fetch
todo-source plugin (sourceNodes hook)
    ↓ createNode
UDL Node Store
    ↓ auto-generated
GraphQL Schema (with filters)
    ↓ infer from store
@udl/codegen (automatic)
    ↓ generate
TypeScript types, guards, helpers
    ↓ import
Your Application
```

## Key Concepts

### Automatic vs Manual Codegen

| Feature    | Automatic (config)         | Manual (CLI)   |
| ---------- | -------------------------- | -------------- |
| Trigger    | On server start            | Run command    |
| Config     | `codegen` in udl.config.ts | CLI flags      |
| Hot reload | Re-generates on restart    | Manual re-run  |
| Best for   | Development                | CI/CD, one-off |

### Type Safety End-to-End

1. Plugin sources data with known structure
2. UDL creates typed nodes in the store
3. GraphQL schema reflects node structure
4. **Codegen automatically generates** matching TypeScript types
5. Your app uses generated types for compile-time safety
6. Type guards provide runtime validation

### Indexed Fields

The `userId` field is registered as an index in the plugin config:

```typescript
export const config = {
  indexes: ['userId'],
};
```

This enables:

- Efficient `getTodoByUserId()` queries with O(1) lookups
- GraphQL filtering with `filter: { userId: { eq: 1 } }`

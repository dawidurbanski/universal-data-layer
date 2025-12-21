---
'@universal-data-layer/codegen-typed-queries': patch
---

Fix pnpm phantom dependency issue with TypedDocumentNode

- Re-export `TypedDocumentNode` type from the package so users don't need to install `@graphql-typed-document-node/core` directly
- Generated code now imports from `@universal-data-layer/codegen-typed-queries` instead of `@graphql-typed-document-node/core`
- Works correctly with pnpm's strict dependency resolution

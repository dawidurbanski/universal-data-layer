---
'universal-data-layer': patch
---

Fix `udl-codegen` CLI to work correctly when run standalone

- Pass `cacheDir` to `loadPlugins()` so cached nodes are found in the app's `.udl-cache` directory instead of the plugin's node_modules
- Use full plugin names instead of `basename()` for owner matching, fixing "No nodes found in store" errors
- Only load manual test configs when running within the UDL monorepo development environment
- Pass GraphQL schema to `runCodegen()` so extensions like `codegen-typed-queries` work correctly
- Make reference resolver registration idempotent to prevent errors when plugins are loaded multiple times

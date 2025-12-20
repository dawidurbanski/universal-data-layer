---
'universal-data-layer': patch
---

Fix config loading errors when importing from universal-data-layer in udl.config.ts:

- Add default export condition to package.json exports field (fixes ERR_PACKAGE_PATH_NOT_EXPORTED)
- Remove top-level await from graphql handler using lazy initialization (fixes ERR_REQUIRE_ASYNC_MODULE)

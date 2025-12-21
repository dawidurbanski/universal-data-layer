---
'universal-data-layer': minor
---

feat(core): add graceful shutdown for production deployments

- Handle SIGTERM and SIGINT signals for graceful shutdown
- Complete in-flight requests before closing server
- Return 503 on `/ready` endpoint during shutdown
- Configurable grace period (default: 30 seconds)
- Clean up file watchers and resources on shutdown
- Log shutdown progress to console

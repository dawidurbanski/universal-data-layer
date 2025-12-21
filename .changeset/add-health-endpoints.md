---
'universal-data-layer': minor
---

Add health check endpoints for production deployments

Introduces `/health` and `/ready` endpoints to support container orchestration (Kubernetes, Docker Swarm), load balancers, and deployment verification.

**Endpoints:**

- `GET /health` - Liveness probe, returns 200 when server is running
- `GET /ready` - Readiness probe, returns 200 when fully initialized, 503 during startup

**Response format:**

```json
// /health
{ "status": "ok", "timestamp": "2025-12-21T10:30:00Z" }

// /ready (when ready)
{ "status": "ready", "timestamp": "2025-12-21T10:30:00Z", "checks": { "graphql": true, "nodeStore": true } }

// /ready (during startup)
{ "status": "initializing", "timestamp": "2025-12-21T10:30:00Z", "checks": { "graphql": false, "nodeStore": false } }
```

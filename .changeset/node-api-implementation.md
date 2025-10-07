---
'universal-data-layer': minor
---

Implement node creation and manipulation API

- Add Node and NodeInternal type definitions
- Implement NodeStore with Map-based storage
- Add utility functions for content digest and node ID generation
- Implement createNode function for node management
- Implement deleteNode function for node removal
- Add node query functions (getNode, getNodes, getNodesByType)
- Implement extendNode function for node manipulation
- Integrate node API with plugin system via sourceNodes hook
- Add automatic GraphQL schema generation from nodes
- Add comprehensive unit and integration tests
- Add manual test feature with demo plugins

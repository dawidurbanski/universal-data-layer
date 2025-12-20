---
'universal-data-layer': patch
---

Fix msw import error when running UDL in consuming projects

Changed msw imports to be dynamic so the package is only loaded when mocks are actually needed. This prevents the "Cannot find package 'msw'" error when running `universal-data-layer` as a dependency, since msw is a devDependency and not installed in consuming projects.

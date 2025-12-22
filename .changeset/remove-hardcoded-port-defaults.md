---
'universal-data-layer': patch
'@universal-data-layer/adapter-nextjs': patch
---

refactor: remove hardcoded default port values

Removed hardcoded default port (4000) from CLI and adapter commands. The port is now only passed when explicitly specified by the user, allowing the config file to determine the default port value instead.

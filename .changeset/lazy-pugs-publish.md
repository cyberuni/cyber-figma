---
'cyber-figma': minor
---

Add the published-library domains: `component`, `component-set`, and `style`. Each ships `team-list`, `file-list`, and `get` on the CLI and the matching `figma_<resource>_<action>` MCP tools, covering all nine Components / Component Sets / Styles endpoints. The team lists declare Figma's integer id-cursor pagination (`page_size` default 30, max 1000), the file lists declare none, and every description states the two rules these endpoints are misread on: they return published library content only, and a file-scoped read needs a main file key because branches cannot publish.

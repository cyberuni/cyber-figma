---
'cyber-figma': minor
---

Add the dev resources domain: `dev-resource list|create|update|delete` and the
`figma_dev_resource_*` MCP tools, covering all four Dev Resources endpoints.
The two bulk writes answer HTTP 200 even when items fail, so every write is
reported as `ok / requested / succeeded / failed / errors` in text, JSON, and
TOON alike, and a write where Figma rejected everything exits nonzero instead
of acknowledging a change that never happened.

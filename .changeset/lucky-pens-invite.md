---
'cyber-figma': minor
---

Add the variables domain: `cyber-figma variable list|collections|get|apply`
and the `figma_variable_list`, `figma_variable_collection_list`,
`figma_variable_get`, and `figma_variable_apply` MCP tools, covering all three
Figma Variables endpoints.

Variables and collections come back as lists rather than the id-keyed maps
Figma sends, `get` resolves the `variableId` a node carries in
`boundVariables`, and `apply` checks a batch change set against the documented
limits — action shape, the 40-mode and 5000-variable ceilings, forbidden name
characters, value types — before spending a request, with `--dry-run` to run
that check alone.

Every operation needs an Enterprise plan, reading included; writing also needs
a Full seat or admin and is not reachable with a plan access token. The CLI
help, the tool descriptions, and the exit code (`7`) all say so.

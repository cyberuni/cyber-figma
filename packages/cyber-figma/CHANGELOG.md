# cyber-figma

## 0.1.0

### Minor Changes

- c40d450: Add the analytics and organization domains: `analytics`, `activity-log`,
  `developer-log`, `ai-usage`, `discovery`, and `payment`, with the matching
  `figma_analytics_*`, `figma_activity_log_list`, `figma_developer_log_list`,
  `figma_ai_usage_daily`, `figma_discovery_text_events`, and `figma_payment_get`
  MCP tools. Together they cover all six Library Analytics endpoints plus Activity
  Logs, Developer Logs, AI Usage, Discovery, and Payments — eleven endpoints, none
  skipped.
  
  Library Analytics ships one command per (asset, metric) pair, because the
  `actions` half is a weekly time series with a date window and the `usages` half
  is a snapshot with none; `--group-by` is required and offers only the two
  dimensions that endpoint actually has.
  
  These endpoints are gated in ways a bare `403` cannot explain, so every command
  and tool description names its requirement: Activity Logs needs OAuth or a plan
  access token and will never work with a personal one; Developer Logs and AI
  Usage are reachable with a plan access token only; Discovery needs OAuth 2 plus
  the Governance+ add-on; and Payments is the reverse — a personal access token
  only, on a resource you own, with no OAuth support at all. Windows, grouping
  dimensions, and enum filters are validated before the request rather than paid
  for in a round trip.
  
  Activity Logs is deliberately declared as an unpaginated endpoint: its response
  carries a cursor that Figma documents no request parameter for, so the result
  reports `has_more` and points at a narrower time window instead of advertising a
  `--cursor` flag that would silently re-request the first page.
- c155cd1: Add the published-library domains: `component`, `component-set`, and `style`. Each ships `team-list`, `file-list`, and `get` on the CLI and the matching `figma_<resource>_<action>` MCP tools, covering all nine Components / Component Sets / Styles endpoints. The team lists declare Figma's integer id-cursor pagination (`page_size` default 30, max 1000), the file lists declare none, and every description states the two rules these endpoints are misread on: they return published library content only, and a file-scoped read needs a main file key because branches cannot publish.
- d1b024c: Add the comments domain: `comment list`, `comment create`, `comment delete`, and
  `comment reaction list|add|delete`, with the matching `figma_comment_*` and
  `figma_comment_reaction_*` MCP tools. Covers all three Comments endpoints and
  all three Comment Reactions endpoints.
  
  Comments can be posted as replies (`--reply-to`) and pinned to a point, a frame,
  or a region (`--x/--y`, `--node-id`, `--region-width/--region-height`,
  `--pin-corner`); `--thread` narrows a listing to one conversation, which Figma's
  flat comment list offers no parameter for. Reactions take an emoji shortcode
  such as `:heart:` and a literal emoji is refused before the request is spent.
  Both deletes are idempotent, and the two rules Figma answers with a bare `403` —
  only the author may delete a comment, only the person who reacted may remove a
  reaction — are reported as hints. Under `--auth-mode plan` the writes are
  refused up front, since Figma does not support `file_comments:write` for plan
  access tokens.
- ca73fb7: Add the dev resources domain: `dev-resource list|create|update|delete` and the
  `figma_dev_resource_*` MCP tools, covering all four Dev Resources endpoints.
  The two bulk writes answer HTTP 200 even when items fail, so every write is
  reported as `ok / requested / succeeded / failed / errors` in text, JSON, and
  TOON alike, and a write where Figma rejected everything exits nonzero instead
  of acknowledging a change that never happened.
- f87b9a1: Add the variables domain: `cyber-figma variable list|collections|get|apply`
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
- 29e6e02: Ship the agent-plugin layer. The package root is the plugin root, so the tarball now carries the Agent Plugins 1.0.0 manifests (`plugin.json`, `mcp.json`), the per-vendor manifests for Claude Code, Cursor, and Codex, and three skills: `init-figma`, `inspect-figma-file`, and `export-figma-assets`.
- ba74636: Add the webhooks domain: `cyber-figma webhook list|get|create|update|delete|requests` and the `figma_webhook_*` MCP tools, covering all seven Webhooks v2 endpoints. Passcodes are masked on every path out — including `--json` and MCP output — and `--passcode-env <VAR>` keeps one out of shell history; endpoints are checked for `https` before Figma is asked to call them; and a refused write names the role that context requires (team admin, or Can edit on the project or file) instead of relaying a bare 403.
- 4924b5c: Add the shared spine: a hand-written typed `fetch` client for the Figma REST
  API (auth modes, integer query coercion, envelope unwrapping, bounded 429
  retry), error classification that names Figma's misleading codes and their
  fixes, normalization of all four pagination families, agent-friendly output
  (TOON/JSON/text, truncation, empty states, next steps), URL and team-scope
  resolution, and the CLI and MCP entrypoints with the seam resource domains
  plug into.

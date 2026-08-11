---
'cyber-figma': minor
---

Add the analytics and organization domains: `analytics`, `activity-log`,
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

---
title: discovery
description: Organization text-event export as hourly download links. Enterprise + Governance+, OAuth 2 only.
sidebar:
  order: 14
---

The organization text-event export: in-file text (Design, FigJam including sticky notes and
tables, Buzz, Sites, Slides), cursor chat, file comments and reactions, component documentation
descriptions and links, Dev Mode annotations and dev resources, and **AI prompts**.

:::danger[Enterprise + Governance+, org admins, OAuth 2 only]
`--auth-mode oauth`, scope `org:discovery_read`. Neither a personal nor a plan access token can
read this one.
:::

This endpoint is also absent from Figma's OpenAPI specification — it is documented in prose
only, which is why a generated client would not have it at all.

## `discovery text-events`

```sh
cyber-figma discovery text-events --start-date <instant>
```

| Option | Description |
| --- | --- |
| `--start-date <instant>` | **Required.** Start of the window, ISO 8601 UTC. Must be at least **one hour in the past** |
| `--end-date <instant>` | End of the window, ISO 8601 UTC. At most **24 hours** after the start (default: one hour after) |
| `--file-ttl <seconds>` | How long the links stay valid: 60–86400 (Figma's default: 86400, one day) |

```sh
cyber-figma discovery text-events --start-date 2026-08-20T00:00:00Z
cyber-figma discovery text-events --start-date 2026-08-20T00:00:00Z \
  --end-date 2026-08-20T12:00:00Z --file-ttl 3600
cyber-figma discovery text-events --start-date 2026-08-20T00:00:00Z --json
```

:::caution[This returns links, not events]
The result is a set of **S3 download URLs — one JSON file per requested hour**, grouped by
hour. Fetching those URLs is the second half of the job, and it is yours to do. A short table
here does not mean there were few events; it means there were few hours.
:::

Links expire after `--file-ttl` and can be **regenerated for the same window at any time** —
the URLs change, the content does not. Use `--json` to get every URL machine-readably.

Discovery reports errors on its own terms: its `429` is documented as more than **20 requests
per second**, and it describes both `401` and `403` as "The OAuth token is invalid" — so an
apparent permission error here is worth re-reading as an auth-mode problem.

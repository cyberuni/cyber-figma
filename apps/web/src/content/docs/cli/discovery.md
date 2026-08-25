---
title: discovery
description: Organization text-event export as hourly download links. Enterprise + Governance+, OAuth 2 only.
sidebar:
  order: 14
---

Organization text-event export — in-file text, cursor chat, comments, component
documentation, Dev Mode annotations, and AI prompts. **Enterprise + Governance+, org admins,
OAuth 2 only** (`--auth-mode oauth`, scope `org:discovery_read`).

| Command | Options |
| --- | --- |
| `discovery text-events` | `--start-date <instant>`, `--end-date <instant>`, `--file-ttl <seconds>` |

This returns **download links, not events** — one JSON file per hour, which you then fetch.
`--start-date` must be at least one hour in the past, `--end-date` at most 24 hours after it,
and `--file-ttl` is 60–86400 seconds.

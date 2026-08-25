---
title: activity-log
description: The organization activity log — the audit trail. Enterprise, org admins, no personal access token.
sidebar:
  order: 11
---

Organization activity log (audit trail). **Enterprise, org admins only, and not readable
with a personal access token** — use `--auth-mode oauth` (scope `org:activity_log_read`) or
`--auth-mode plan`.

| Command | Options |
| --- | --- |
| `activity-log list` | `--events <types>`, `--start-time <time>`, `--end-time <time>`, `--limit <number>`, `--order <direction>` |

`--start-time` / `--end-time` accept Unix seconds, an ISO 8601 instant, or `YYYY-MM-DD`
(midnight UTC), and default to one year ago and now. A window that ends before it starts is
refused before the request is spent.

:::note[No cursor to page with]
The response reports `has_more`, but Figma documents no `cursor` request parameter to send
the cursor back to. Page by narrowing the time window and using `--order`.
:::

---
title: activity-log
description: The organization activity log — the audit trail. Enterprise, org admins, no personal access token.
sidebar:
  order: 11
---

The organization activity log: who did what, to which entity, when. Figma intends this for SIEM
integration and states it "can only be used by Figma Enterprise organizations building internal
applications". Rate limit tier 3.

:::danger[Enterprise, org admins, and not a personal access token]
This endpoint accepts **org OAuth** (scope `org:activity_log_read`) or a **plan access token**
— a personal access token is not among its documented credentials, no matter what the account
behind it can do in the UI. Use `--auth-mode oauth` or `--auth-mode plan`.
:::

## `activity-log list`

```sh
cyber-figma activity-log list
```

Lists timestamp, action type, actor, and entity for each event.

| Option | Description |
| --- | --- |
| `--events <types>` | Comma-separated event types (all events by default) |
| `--start-time <time>` | Least recent event (default: one year ago) |
| `--end-time <time>` | Most recent event (default: now) |
| `--limit <number>` | Maximum events to return (Figma's default: 1000) |
| `--order <direction>` | `asc` (Figma's default) or `desc` |

`--start-time` and `--end-time` accept **Unix seconds, an ISO 8601 instant, or `YYYY-MM-DD`**
(midnight UTC) — you do not have to convert anything by hand. A window that ends before it
starts is refused locally, before the call is spent.

```sh
cyber-figma activity-log list --start-time 2026-01-01 --end-time 2026-02-01 --order desc
cyber-figma activity-log list --events file.create --json
cyber-figma activity-log list --start-time 1767225600 --limit 100
```

Two things about the data: the actor is `null` for system-driven events, and named
`SCIM Provider` for SCIM-driven ones and `Figma Support` for official support actions — so an
audit query that groups by actor should expect those.

:::note[No cursor to page with]
The response reports `has_more` and even returns a `cursor`, but Figma documents **no `cursor`
request parameter** to send it back to. There is nowhere to put it, so the CLI does not offer
a `--cursor` it cannot honor. Page by narrowing the window, or walk it with `--order desc` and
a moving `--end-time`.
:::

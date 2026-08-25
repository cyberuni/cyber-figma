---
title: ai-usage
description: Organization AI credit usage by day. Enterprise, org admins, plan access token only.
sidebar:
  order: 13
---

Per-user, per-day AI credit aggregates for the organization.

:::danger[Enterprise, org admins, plan access token only]
`--auth-mode plan`, scope `org:ai_metering_usage_read`. A personal access token cannot read
this.
:::

## `ai-usage daily`

```sh
cyber-figma ai-usage daily --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD>
```

Lists day, user, editor type, seat credits, and plan credits, then totals the rows shown.

| Option | Description |
| --- | --- |
| `--start-date <YYYY-MM-DD>` | **Required.** First day, inclusive (UTC) |
| `--end-date <YYYY-MM-DD>` | **Required.** Last day, inclusive (UTC) |
| `--user-email <email>` | Restrict to one user |
| `--cursor <cursor>` | Where to resume |
| `--page-size <number>` | Rows per page (Figma's default and maximum: 1000) |
| `--all` / `--max-pages <number>` | Fetch every page, up to a ceiling (default: 10) |

```sh
cyber-figma ai-usage daily --start-date 2026-07-01 --end-date 2026-07-31
cyber-figma ai-usage daily --start-date 2026-07-01 --end-date 2026-07-31 \
  --user-email designer@example.com
cyber-figma ai-usage daily --start-date 2026-07-01 --end-date 2026-07-31 --all --toon
```

Both dates are required, must be `YYYY-MM-DD`, must be **no earlier than 2025-12-01** — the
day the data starts — and no more than 366 days back. The end date must be today or earlier,
and no earlier than the start.

`--user-email` restricts to one user, and an address matching **no** Figma user is an **error,
not an empty result** — which is the useful behavior: a typo tells you it was a typo.

:::note[The current day is always incomplete]
Data lags real time by **5–6 hours**. Treat today's row as provisional, and prefer windows that
end yesterday for anything you report on.
:::

Rows are ordered by day, then user, then editor type, and are attributed to a workspace, team,
or license group.

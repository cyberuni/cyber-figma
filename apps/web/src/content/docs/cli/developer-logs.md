---
title: developer-log
description: Organization developer logs — every REST API and MCP request made against the org. Enterprise + Governance+.
sidebar:
  order: 12
---

Organization developer logs — every REST API and MCP server request made against the org,
retained **30 days**. **Enterprise + Governance+, org admins, plan access token only**
(`--auth-mode plan`, scope `org:developer_log_read`).

| Command | Options |
| --- | --- |
| `developer-log list` | `--token-type`, `--filter-token`, `--token-name`, `--user-email`, `--ip-address`, `--event-source`, `--date-range`, `--cursor`, `--page-size`, `--all`, `--max-pages` |

The filters take comma-separated prefixes. `--filter-token` matches on the token value, which
is a secret — prefer `--token-name`.

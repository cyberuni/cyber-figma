---
title: ai-usage
description: Organization AI credit usage by day. Enterprise, org admins, plan access token only.
sidebar:
  order: 13
---

Organization AI credit usage. **Enterprise, org admins, plan access token only**
(`--auth-mode plan`, scope `org:ai_metering_usage_read`).

| Command | Options |
| --- | --- |
| `ai-usage daily` | `--start-date`, `--end-date`, `--user-email`, `--cursor`, `--page-size`, `--all`, `--max-pages` |

Both dates are required, `YYYY-MM-DD`, no earlier than **2025-12-01**, and the end no earlier
than the start. `--user-email` restricts to one user; an address matching no Figma user is an
error rather than an empty result. Data lags real time by **5–6 hours**, so the current day is
always incomplete.

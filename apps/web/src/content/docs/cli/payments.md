---
title: payment
description: Purchase validation for a plugin, widget, or Community file you own. Personal access token only.
sidebar:
  order: 15
---

Purchase validation for a plugin, widget, or Community file you own. **Personal access token
only** — the Payments API supports neither OAuth 2 nor plan access tokens.

| Command | Options |
| --- | --- |
| `payment get` | `--plugin-payment-token <token>`, `--user-id <id>`, `--community-file-id <id>`, `--plugin-id <id>`, `--widget-id <id>` |

Two modes: a `--plugin-payment-token` from `getPluginPaymentTokenAsync` inside a plugin or
widget, or `--user-id` plus exactly one resource id from a server.

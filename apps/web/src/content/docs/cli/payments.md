---
title: payment
description: Purchase validation for a plugin, widget, or Community file you own. Personal access token only.
sidebar:
  order: 15
---

Validates whether a user has paid for a plugin, widget, or Community file **you own**. Rate
limit tier 3.

:::danger[Personal access token only]
Figma's docs state plainly that the Payments API does not support OAuth 2, and it has no plan
access token support either. A plugin payment token is not a substitute for a personal access
token — you need both in the plugin flow below.
:::

## `payment get`

```sh
cyber-figma payment get --plugin-payment-token <token>
cyber-figma payment get --user-id <id> --plugin-id <id>
```

There are two modes, and which options you pass selects between them:

| Option | Description |
| --- | --- |
| `--plugin-payment-token <token>` | Short-lived token from `getPluginPaymentTokenAsync`, used **inside a plugin or widget** |
| `--user-id <id>` | The Figma user id to ask about, used **from a server** |
| `--community-file-id <id>` | Community file id — the number after `file/` on its Community page |
| `--plugin-id <id>` | Plugin id |
| `--widget-id <id>` | Widget id |

From inside a plugin or widget, the payment token identifies both the user and the resource, so
it is the only option you need. From anywhere else, pass `--user-id` plus **exactly one**
resource id. You obtain a user id by having the user OAuth to the REST API.

```sh
cyber-figma payment get --user-id 987654321 --plugin-id 123456789
cyber-figma payment get --user-id 987654321 --community-file-id 123456789 --json
```

The result reports the user, the resource, the payment status, and the purchase date.

:::note[`TRIAL` is not `PAID`]
A `TRIAL` status means the user is inside the trial period of a subscription, not that they
have paid. Gate features on the distinction you actually mean.
:::

You can only query resources you own.

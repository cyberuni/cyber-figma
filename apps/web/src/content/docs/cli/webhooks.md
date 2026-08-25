---
title: webhook
description: Webhooks v2 — create, inspect, and delete event subscriptions, and check delivery health.
sidebar:
  order: 7
---

Webhooks v2 — subscribe to file, project, and team events.

| Command | Options |
| --- | --- |
| `webhook list` | `--context <team\|project\|file>`, `--context-id <id>`, `--plan <plan_api_id>`, `--cursor`, `--all`, `--max-pages` |
| `webhook get <webhook-id>` | — |
| `webhook create` | `--event`, `--context`, `--context-id`, `--endpoint <url>`, `--passcode` / `--passcode-env`, `--status`, `--description` |
| `webhook update <webhook-id>` | `--event`, `--endpoint`, `--passcode` / `--passcode-env`, `--status`, `--description` |
| `webhook delete <webhook-id>` | — |
| `webhook requests <webhook-id>` | `--failed-only` |
| `webhook list-team [team]` | Deprecated compatibility shim |

Events: `PING`, `FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_DELETE`, `LIBRARY_PUBLISH`,
`FILE_COMMENT`, `DEV_MODE_STATUS_UPDATE`.

:::caution[An ACTIVE webhook fires immediately]
Creating one `ACTIVE` makes Figma `POST` a `PING` to the endpoint straight away. Create it
`--status PAUSED` when the endpoint is not live yet.
:::

`--passcode-env <variable>` names an environment variable holding the passcode, so the secret
never reaches shell history or the process list. Prefer it to `--passcode`.

An update **replaces** the webhook: `--event`, `--endpoint`, and the passcode are all
required even to change one of them, and a webhook cannot be re-targeted at another team,
project, or file. `webhook requests` covers the last week of deliveries, which is the only
health signal Figma keeps; `error_msg` is `null` when a delivery succeeded. There is no
webhook UI in Figma — this is the whole management surface.

`webhook list-team` calls the superseded `GET /v2/teams/{id}/webhooks`. It is here so an
existing script keeps working; use `webhook list --context team` instead.

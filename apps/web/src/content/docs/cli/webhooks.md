---
title: webhook
description: Webhooks v2 — create, inspect, and delete event subscriptions, and check delivery health.
sidebar:
  order: 7
---

Webhooks v2 — subscribe to file, project, and team events. **There is no webhook UI in
Figma**, so this is the whole management surface: whatever the API does not show you, nothing
does.

| Command | What it does |
| --- | --- |
| [`webhook list`](#webhook-list) | Webhooks on a context, or across a plan |
| [`webhook get`](#webhook-get) | One webhook |
| [`webhook create`](#webhook-create) | Create a subscription |
| [`webhook update`](#webhook-update) | Replace a webhook's settings |
| [`webhook delete`](#webhook-delete) | Delete a webhook |
| [`webhook requests`](#webhook-requests) | The last week of deliveries |
| [`webhook list-team`](#webhook-list-team) | Deprecated compatibility shim |

**Events:** `PING`, `FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_DELETE`, `LIBRARY_PUBLISH`,
`FILE_COMMENT`, `DEV_MODE_STATUS_UPDATE`.
**Contexts:** `team`, `project`, `file`.
**Statuses:** `ACTIVE`, `PAUSED`.

Who may create one: a **team** webhook needs a team admin; **project** and **file** webhooks
need Can edit on that project or file. The caps are 20 webhooks per team, 5 per project, and 3
per file.

## `webhook list`

```sh
cyber-figma webhook list --context <context> --context-id <id>
cyber-figma webhook list --plan <plan_api_id>
```

| Option | Description |
| --- | --- |
| `--context <context>` | What the webhook watches: `team`, `project`, or `file` |
| `--context-id <id>` | Id or Figma URL of that team, project, or file (defaults to `FIGMA_TEAM_ID`) |
| `--plan <plan_api_id>` | Every webhook across every context you can reach on a plan |
| `--cursor <cursor>` | Where to resume — **`--plan` only** |
| `--all` / `--max-pages <number>` | Fetch every page, up to a ceiling (default: 10) |

```sh
cyber-figma webhook list --context team
cyber-figma webhook list --context file --context-id abc123
cyber-figma webhook list --plan team-1234567890 --all
```

The two modes behave differently, and the difference is Figma's, not the CLI's: a **context**
query returns everything at once, while a **plan** query is the only form that paginates.
`--context-id` and `--plan` are mutually exclusive.

Build `--plan` as `team-<teamId>` on Professional, or `organization-<orgId>` on Organization,
Enterprise, and Government plans. The team id follows `/team/` in a Figma URL; the org id
follows `/files/`.

## `webhook get`

```sh
cyber-figma webhook get <webhook-id>
```

Shows the event type, context, status, endpoint, description, plan id, and the OAuth client
that registered it. **The passcode is never printed** in any output format — Figma returns an
empty string for it on reads anyway, and the CLI masks it rather than showing a placeholder.

## `webhook create`

```sh
cyber-figma webhook create --event <type> --context <context> --endpoint <url> --passcode-env <VAR>
```

| Option | Description |
| --- | --- |
| `--event <type>` | **Required.** The event to subscribe to |
| `--context <context>` | **Required.** `team`, `project`, or `file` |
| `--context-id <id>` | Id or Figma URL of the context (defaults to `FIGMA_TEAM_ID`) |
| `--endpoint <url>` | **Required.** HTTPS URL Figma will `POST` events to (max 2048 characters) |
| `--passcode-env <variable>` | Name of an environment variable holding the passcode — **preferred** |
| `--passcode <passcode>` | The passcode itself; visible in shell history and the process list |
| `--status <status>` | `ACTIVE` or `PAUSED` |
| `--description <text>` | A note to yourself about what this webhook is for |

```sh
export FIGMA_WEBHOOK_PASSCODE='…'
cyber-figma webhook create --event FILE_UPDATE --context file --context-id abc123 \
  --endpoint https://example.com/figma --passcode-env FIGMA_WEBHOOK_PASSCODE --status PAUSED

cyber-figma webhook create --event LIBRARY_PUBLISH --context team \
  --endpoint https://example.com/figma --passcode-env FIGMA_WEBHOOK_PASSCODE \
  --description 'Rebuild the token pipeline on publish'
```

A passcode is required. Figma echoes it back in every payload so your endpoint can verify the
caller really is Figma — treat it as a shared secret, which is why `--passcode-env` exists and
why it is the option to reach for.

:::caution[An ACTIVE webhook fires immediately]
Creating one `ACTIVE` makes Figma `POST` a `PING` to the endpoint straight away. Create it
`--status PAUSED` when the endpoint is not live yet, confirm with
[`webhook requests`](#webhook-requests), then activate it with an update.
:::

## `webhook update`

```sh
cyber-figma webhook update <webhook-id> --event <type> --endpoint <url> --passcode-env <VAR>
```

Takes the same options as `create`, minus `--context` and `--context-id`.

**An update replaces the whole webhook.** `--event`, `--endpoint`, and a passcode are all
required even when you are only changing the status — that is Figma's `PUT` semantics, not a
CLI choice. And because the context is not part of the update body, **a webhook cannot be
re-targeted** at another team, project, or file: delete it and create a new one.

```sh
cyber-figma webhook update 42 --event FILE_UPDATE --endpoint https://example.com/figma \
  --passcode-env FIGMA_WEBHOOK_PASSCODE --status ACTIVE
```

## `webhook delete`

```sh
cyber-figma webhook delete <webhook-id>
```

Figma cannot reverse this. The delete is idempotent — deleting one that is already gone
reports `already_absent` rather than failing.

## `webhook requests`

```sh
cyber-figma webhook requests <webhook-id>
```

The deliveries Figma attempted in the **last week** — the only health signal it keeps. Prints
each attempt's send time, the response status, and the error, then a summary of how many were
delivered and how many failed.

| Option | Description |
| --- | --- |
| `--failed-only` | Show only the deliveries that errored |

```sh
cyber-figma webhook requests 42 --failed-only
```

`error_msg` is `null` when a delivery succeeded. Your endpoint must answer `200 OK` promptly;
anything else, including a timeout, counts as an error. Figma retries a failed delivery
**3 times — after 5 minutes, 30 minutes, and 3 hours** — and **never disables a webhook** that
keeps failing, so a broken endpoint stays broken until you pause it.

## `webhook list-team`

```sh
cyber-figma webhook list-team [team]
```

Calls the superseded `GET /v2/teams/{id}/webhooks`. It exists so an existing script keeps
working; use [`webhook list --context team`](#webhook-list) instead.

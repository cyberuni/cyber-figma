---
title: Command reference
description: Every cyber-figma command, argument, and option, grouped by resource.
sidebar:
  order: 2
---

Every command follows `cyber-figma <resource> <action> [options]` and accepts the
[global options](/cyber-figma/cli/#global-options) on top of what is listed here. Anywhere a
file, team, or project id is accepted, the matching Figma URL is accepted too.

Run `cyber-figma <resource> --help` for the same reference in the terminal, and
`cyber-figma` with no arguments for the configuration check and the resource list.

## file

Files: document, nodes, renders, metadata, and version history.

| Command | What it does |
| --- | --- |
| `file get <file>` | The file's document tree. **Rate limit tier 1** |
| `file nodes <file>` | The document of specific nodes. **Rate limit tier 1** |
| `file images <file>` | Render nodes to image URLs. **Rate limit tier 1** |
| `file image-fills <file>` | Download URLs for the user-supplied images used as fills |
| `file meta <file>` | File metadata without the document — tier 3, the cheapest |
| `file versions <file>` | Version history — tier 2 |

:::caution[Three of these are Figma's most expensive calls]
`file get`, `file nodes`, and `file images` are tier 1, and a View or Collab seat is allowed
roughly **6 tier-1 calls per month**. Use `file meta` for listing and inspection, and see
[Plans and limits](/cyber-figma/reference/plans-and-limits/).
:::

`file get` and `file nodes`:

| Option | Description |
| --- | --- |
| `--ids <ids>` | Only these node ids (comma-separated; dashed URL ids accepted) |
| `--depth <n\|all>` | Tree depth: `1` = pages, `2` = pages and their top-level objects, `all` = whole tree |
| `--version <id>` | A specific version id (default: the current version) |
| `--geometry` | Include vector geometry as paths |
| `--plugin-data <ids>` | Comma-separated plugin ids and/or the string `shared` |
| `--branch-data` | Include branch metadata — the only way to obtain a branch key (`file get` only) |

With neither `--ids` nor `--depth`, `file get` returns pages only (depth 1). That default is
deliberate: on a tier-1 endpoint, fetching the whole tree by default is a bug.

`file images`:

| Option | Description |
| --- | --- |
| `--ids <ids>` | Node ids to render in **one** call — batching is how Figma says to avoid rate limits |
| `--format <format>` | `jpg`, `png`, `svg`, or `pdf` (default: `png`) |
| `--scale <number>` | Render scale, 0.01–4 |
| `--version <id>` | A specific version id |
| `--svg-outline-text` | Render text as vector paths instead of `<text>` elements |
| `--svg-include-id` | Add the layer name to each element `id` attribute |
| `--svg-include-node-id` | Add the node id to each element `data-node-id` attribute |
| `--svg-simplify-stroke` | Use stroke attributes instead of `<mask>` where possible |
| `--contents-only` | Exclude overlapping content |
| `--use-absolute-bounds` | Use full node dimensions, ignoring cropping |

A `null` URL in the result means **that node** did not render; the call itself succeeded.
Rendered URLs expire after 30 days, image-fill URLs after at most 14.

`file versions` paginates: `--page-size <number>` (default 30), `--before <id>` /
`--after <id>`, `--all`, `--max-pages <number>`.

## project

Projects in a team, and the files inside them.

| Command | Options |
| --- | --- |
| `project list [team]` | Team id or URL; defaults to `--team`, then `FIGMA_TEAM_ID` |
| `project get <project>` | — |
| `project files <project>` | `--branch-data` includes branch metadata for each main file that has branches |

This is the discovery path: a team id leads to projects, projects to files, and a file to the
file key every `file` command takes. Figma has no endpoint that discovers a team id from a
token, which is why [`FIGMA_TEAM_ID`](/cyber-figma/authentication/) exists.

## comment

Comments on a file, and reactions to them.

| Command | Options |
| --- | --- |
| `comment list <file>` | `--as-md`, `--thread <comment-id>` |
| `comment create <file>` | `--message <text>`, `--reply-to <comment-id>`, `--node-id <id>`, `--x`, `--y`, `--region-width`, `--region-height`, `--pin-corner <corner>` |
| `comment delete <file> <comment-id>` | — |
| `comment reaction list <file> <comment-id>` | `--cursor`, `--all`, `--max-pages` |
| `comment reaction add <file> <comment-id>` | `--emoji <shortcode>` |
| `comment reaction delete <file> <comment-id>` | `--emoji <shortcode>` |

`comment list` returns root comments and replies in one flat list; a reply carries
`parent_id`. A reply must target a **root** comment — you cannot reply to a reply. With
`--node-id`, `--x` / `--y` are the offset from that frame's top-left corner rather than
canvas coordinates.

Only the author may delete a comment, and only the person who left a reaction may remove it.
`--emoji` takes an emoji shortcode, such as `:heart:` or `:+1::skin-tone-2:`. Comment writes
are **not available with a plan access token**.

## user

| Command | What it does |
| --- | --- |
| `user me` | The account the current credential belongs to |

The connection check for a personal access token or OAuth. It is **not reachable with a plan
access token**, so in that mode check the connection with something else, such as
`project list`.

## component, component-set, style

Three parallel families with identical shapes, all covering **published library content
only** — not every component or style in a file.

| Command | Scope | Scope required |
| --- | --- | --- |
| `component team-list [team]` | A team's published components | `team_library_content:read` |
| `component file-list <file>` | One file's published components | `library_content:read` |
| `component get <key>` | One component by library key | `library_assets:read` |
| `component-set team-list [team]` | A team's published component sets | `team_library_content:read` |
| `component-set file-list <file>` | One file's published component sets | `library_content:read` |
| `component-set get <key>` | One component set by library key | `library_assets:read` |
| `style team-list [team]` | A team's published styles | `team_library_content:read` |
| `style file-list <file>` | One file's published styles | `library_content:read` |
| `style get <key>` | One style by library key | `library_assets:read` |

`get` takes the **library key**, not a node id. The `file-list` commands need a **main file
key, not a branch key**, because branches cannot publish. The `team-list` commands paginate
with `--page-size <number>` (default 30, max 1000), `--before <id>` / `--after <id>`,
`--all`, and `--max-pages <number>`.

## webhook

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

## variable

Variables and variable collections. **Enterprise plan, for reads as well as writes.**

| Command | Options |
| --- | --- |
| `variable list <file>` | `--published`, `--collection <id>` |
| `variable collections <file>` | `--published` |
| `variable get <file> <variable-id>` | `--published` |
| `variable apply <file>` | `--changes <json\|@path>`, `--dry-run` |

The local view is the only place mode values are readable; the published view omits modes.
`variable get` is how you resolve the `variableId` a node carries in `boundVariables`.

`variable apply` creates, updates, and deletes variables, collections, modes, and mode values
in one batch. `--changes` takes JSON inline or `@<path>` to read it from a file, with the
keys `variableCollections`, `variableModes`, `variables`, and `variableModeValues` — applied
in that order. A `CREATE` may carry a temporary id that later entries reference, and the
response maps those to real ids. Run it with `--dry-run` first: it validates the change set
and reports what it would touch without sending anything.

:::caution[REST cannot publish]
Changes are visible only in that file until the library is published, and publishing is a UI
or plugin action with no REST equivalent. Writing also needs a Full seat or admin, Edit
access on the file, and a credential that is **not** a plan access token.
:::

## dev-resource

Dev Mode resources — developer links attached to file nodes.

| Command | Options |
| --- | --- |
| `dev-resource list <file>` | `--node-ids <ids>` |
| `dev-resource create <file>` | `--node <ids>`, `--name <name>`, `--url <url>` |
| `dev-resource update <dev-resource-id>` | `--name <name>`, `--url <url>` |
| `dev-resource delete <file> <dev-resource-id>` | — |

Dev resources are live immediately — unlike variables, components, and styles, they need no
publish step. Every one of these commands needs a **main file key, not a branch key**.

:::caution[A 200 is not proof of success]
Create and update have partial-success semantics: Figma answers `200` even when some items
fail. Read `ok`, `succeeded`, `failed`, and `errors` in the result. Documented causes are an
unknown file key, a node already holding the maximum of 10 dev resources, and a duplicate URL
on the same node.
:::

## analytics

Library Analytics for a published library file. **Enterprise plan**, scope
`library_analytics:read`.

| Command | `--group-by` | Date range |
| --- | --- | --- |
| `analytics component-actions <file>` | `component` \| `team` | yes |
| `analytics component-usages <file>` | `component` \| `file` | no |
| `analytics style-actions <file>` | `style` \| `team` | yes |
| `analytics style-usages <file>` | `style` \| `file` | no |
| `analytics variable-actions <file>` | `variable` \| `team` | yes |
| `analytics variable-usages <file>` | `variable` \| `file` | no |

The `-actions` commands are a weekly time series and take `--start-date` / `--end-date`
(`YYYY-MM-DD`, rounded out to whole weeks). The `-usages` commands are a snapshot and take no
date range at all. All six paginate with `--cursor`, `--all`, and `--max-pages`.

Figma recomputes this data **daily at 00:00 UTC**, so polling more often gains nothing. Rows
you lack permission for come back named `Team not visible` / `File not visible` rather than
being dropped, and must not be aggregated as one entity.

Unlike the other Enterprise domains, analytics works with a personal access token, a plan
token, or OAuth.

## activity-log

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

## developer-log

Organization developer logs — every REST API and MCP server request made against the org,
retained **30 days**. **Enterprise + Governance+, org admins, plan access token only**
(`--auth-mode plan`, scope `org:developer_log_read`).

| Command | Options |
| --- | --- |
| `developer-log list` | `--token-type`, `--filter-token`, `--token-name`, `--user-email`, `--ip-address`, `--event-source`, `--date-range`, `--cursor`, `--page-size`, `--all`, `--max-pages` |

The filters take comma-separated prefixes. `--filter-token` matches on the token value, which
is a secret — prefer `--token-name`.

## ai-usage

Organization AI credit usage. **Enterprise, org admins, plan access token only**
(`--auth-mode plan`, scope `org:ai_metering_usage_read`).

| Command | Options |
| --- | --- |
| `ai-usage daily` | `--start-date`, `--end-date`, `--user-email`, `--cursor`, `--page-size`, `--all`, `--max-pages` |

Both dates are required, `YYYY-MM-DD`, no earlier than **2025-12-01**, and the end no earlier
than the start. `--user-email` restricts to one user; an address matching no Figma user is an
error rather than an empty result. Data lags real time by **5–6 hours**, so the current day is
always incomplete.

## discovery

Organization text-event export — in-file text, cursor chat, comments, component
documentation, Dev Mode annotations, and AI prompts. **Enterprise + Governance+, org admins,
OAuth 2 only** (`--auth-mode oauth`, scope `org:discovery_read`).

| Command | Options |
| --- | --- |
| `discovery text-events` | `--start-date <instant>`, `--end-date <instant>`, `--file-ttl <seconds>` |

This returns **download links, not events** — one JSON file per hour, which you then fetch.
`--start-date` must be at least one hour in the past, `--end-date` at most 24 hours after it,
and `--file-ttl` is 60–86400 seconds.

## payment

Purchase validation for a plugin, widget, or Community file you own. **Personal access token
only** — the Payments API supports neither OAuth 2 nor plan access tokens.

| Command | Options |
| --- | --- |
| `payment get` | `--plugin-payment-token <token>`, `--user-id <id>`, `--community-file-id <id>`, `--plugin-id <id>`, `--widget-id <id>` |

Two modes: a `--plugin-payment-token` from `getPluginPaymentTokenAsync` inside a plugin or
widget, or `--user-id` plus exactly one resource id from a server.

## oembed

| Command | Options |
| --- | --- |
| `oembed get <url>` | `--max-width <pixels>`, `--max-height <pixels>` |

Describes a Figma file or published Make URL as an embeddable resource
([oEmbed 1.0](https://oembed.com/)): title, thumbnail, file key, and iframe HTML. It takes a
**link, not a file key**, is cheaper than reading the file, and is not reachable with a plan
access token. Sizes default to 800×450 and are adjusted to keep 16:9.

## mcp

| Command | What it does |
| --- | --- |
| `mcp` | Serve the [MCP server](/cyber-figma/mcp/) over stdio |

Started by an agent host, not by hand.

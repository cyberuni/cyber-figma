---
title: Tool reference
description: Every cyber-figma MCP tool, its parameters, and what it costs or requires.
sidebar:
  order: 2
---

Fifty-one tools, named `figma_<resource>_<action>`. Each calls the same core operation as the
matching [CLI command](/cyber-figma/cli/commands/), so the behavior notes there apply here
too. Every tool returns JSON; set `CYBER_FIGMA_MCP_FORMAT=toon` on the server to get
[TOON](/cyber-figma/mcp/#output-format) instead.

Parameters are listed in schema order. Pagination parameters — `cursor` or `before` /
`after`, `page_size`, `fetch_all`, `max_pages` — appear only on tools whose endpoint really
pages.

## Files

| Tool | Parameters |
| --- | --- |
| `figma_file_get` | `file`, `ids`, `depth`, `version`, `geometry`, `plugin_data`, `branch_data` |
| `figma_file_nodes` | `file`, `ids`, `depth`, `version`, `geometry`, `plugin_data` |
| `figma_file_images` | `file`, `ids`, `format`, `scale`, `version`, `svg_outline_text`, `svg_include_id`, `svg_include_node_id`, `svg_simplify_stroke`, `contents_only`, `use_absolute_bounds` |
| `figma_file_image_fills` | `file` |
| `figma_file_meta` | `file` |
| `figma_file_versions` | `file`, `page_size`, `before`, `after`, `fetch_all`, `max_pages` |

:::caution[The first three are rate limit tier 1]
A View or Collab seat gets roughly **6 tier-1 calls per month**. Point an agent at
`figma_file_meta` (tier 3) for listing and inspection, and say so in its instructions — the
tool descriptions say it, but a plan written before the first call is cheaper than a `429`.
:::

`figma_file_get` with neither `ids` nor `depth` returns pages only. On `figma_file_images`,
pass every node id in one call, and read a `null` URL as "that node did not render" rather
than as a failed request.

## Projects

| Tool | Parameters |
| --- | --- |
| `figma_project_list` | `team` |
| `figma_project_get` | `project` |
| `figma_project_files` | `project`, `branch_data` |

The discovery path: team id → projects → files → the file key every file tool takes.

## Comments

| Tool | Parameters |
| --- | --- |
| `figma_comment_list` | `file`, `as_md`, `thread` |
| `figma_comment_create` | `file`, `message`, `reply_to`, `node_id`, `x`, `y`, `region_width`, `region_height`, `pin_corner` |
| `figma_comment_delete` | `file`, `comment_id` |
| `figma_comment_reaction_list` | `file`, `comment_id`, `cursor`, `fetch_all`, `max_pages` |
| `figma_comment_reaction_add` | `file`, `comment_id`, `emoji` |
| `figma_comment_reaction_delete` | `file`, `comment_id`, `emoji` |

`figma_comment_list` returns root comments and replies in one flat list; a reply carries
`parent_id`. Only the author may delete a comment, and only the person who left a reaction
may remove it. Comment writes are not available with a plan access token.

## Users

| Tool | Parameters |
| --- | --- |
| `figma_user_me` | — |

The connection check for a personal or OAuth credential. Not reachable with a plan access
token.

## Library content

All nine cover **published** library content only.

| Tool | Parameters |
| --- | --- |
| `figma_component_team_list` | `team`, `page_size`, `before`, `after`, `fetch_all`, `max_pages` |
| `figma_component_file_list` | `file` |
| `figma_component_get` | `key` |
| `figma_component_set_team_list` | `team`, `page_size`, `before`, `after`, `fetch_all`, `max_pages` |
| `figma_component_set_file_list` | `file` |
| `figma_component_set_get` | `key` |
| `figma_style_team_list` | `team`, `page_size`, `before`, `after`, `fetch_all`, `max_pages` |
| `figma_style_file_list` | `file` |
| `figma_style_get` | `key` |

`key` is the library key, not a node id. The `file_list` tools need a main file key, not a
branch key.

## Webhooks

| Tool | Parameters |
| --- | --- |
| `figma_webhook_list` | `context`, `context_id`, `plan_api_id`, `cursor`, `fetch_all`, `max_pages` |
| `figma_webhook_get` | `webhook_id` |
| `figma_webhook_create` | `event_type`, `context`, `context_id`, `endpoint`, `passcode`, `status`, `description` |
| `figma_webhook_update` | `webhook_id`, `event_type`, `endpoint`, `passcode`, `status`, `description` |
| `figma_webhook_delete` | `webhook_id` |
| `figma_webhook_requests` | `webhook_id` |

Creating a webhook with `status: "ACTIVE"` makes Figma `POST` a `PING` to the endpoint
immediately; use `"PAUSED"` when the endpoint is not live yet. An update replaces the
webhook — `event_type`, `endpoint`, and `passcode` are all required even to change one — and
cannot re-target it. `figma_webhook_requests` covers the last week, the only health signal
Figma keeps.

The deprecated team-scoped webhook list is a CLI-only compatibility shim and has no tool.

## Variables

**Enterprise plan, for reads as well as writes.**

| Tool | Parameters |
| --- | --- |
| `figma_variable_list` | `file`, `published`, `collection_id` |
| `figma_variable_collection_list` | `file`, `published` |
| `figma_variable_get` | `file`, `variable_id`, `published` |
| `figma_variable_apply` | `file`, `changes`, `dry_run` |

The local view is the only place mode values are readable. `figma_variable_apply` applies
`variableCollections`, `variableModes`, `variables`, and `variableModeValues` in that order,
and maps any temporary ids in the response. Run it with `dry_run` first. Changes are visible
only in that file until the library is published, which the REST API cannot do.

## Dev resources

| Tool | Parameters |
| --- | --- |
| `figma_dev_resource_list` | `file`, `node_ids` |
| `figma_dev_resource_create` | `resources` |
| `figma_dev_resource_update` | `resources` |
| `figma_dev_resource_delete` | `file`, `dev_resource_id` |

Create and update take a `resources` array and write across several files in one call.
Figma answers them with `200` even when some items fail, so read `ok`, `succeeded`, `failed`,
and `errors` in the result.

## Library Analytics

**Enterprise plan**, scope `library_analytics:read`.

| Tool | Parameters |
| --- | --- |
| `figma_analytics_component_actions` | `file`, `group_by`, `start_date`, `end_date`, `cursor`, `fetch_all`, `max_pages` |
| `figma_analytics_component_usages` | `file`, `group_by`, `cursor`, `fetch_all`, `max_pages` |
| `figma_analytics_style_actions` | `file`, `group_by`, `start_date`, `end_date`, `cursor`, `fetch_all`, `max_pages` |
| `figma_analytics_style_usages` | `file`, `group_by`, `cursor`, `fetch_all`, `max_pages` |
| `figma_analytics_variable_actions` | `file`, `group_by`, `start_date`, `end_date`, `cursor`, `fetch_all`, `max_pages` |
| `figma_analytics_variable_usages` | `file`, `group_by`, `cursor`, `fetch_all`, `max_pages` |

`group_by` is required, and its legal values differ per pair: the asset itself plus `team`
for actions, the asset itself plus `file` for usages. The `_actions` tools are a weekly time
series; the `_usages` tools are a snapshot with no date range. Data is recomputed daily at
00:00 UTC, and rows you lack permission for arrive named `Team not visible` /
`File not visible` rather than being dropped.

## Organization reporting

Four Enterprise tools, each reachable with one kind of credential and no other.

| Tool | Parameters | Requires |
| --- | --- | --- |
| `figma_activity_log_list` | `events`, `start_time`, `end_time`, `limit`, `order` | Enterprise, org admin, **OAuth or plan token** |
| `figma_developer_log_list` | `token_type`, `token`, `token_name`, `user_email`, `ip_address`, `event_source`, `date_range`, `cursor`, `page_size`, `fetch_all`, `max_pages` | Enterprise + Governance+, org admin, **plan token only** |
| `figma_ai_usage_daily` | `start_date`, `end_date`, `user_email`, `cursor`, `page_size`, `fetch_all`, `max_pages` | Enterprise, org admin, **plan token only** |
| `figma_discovery_text_events` | `start_date`, `end_date`, `file_ttl_in_seconds` | Enterprise + Governance+, org admin, **OAuth 2 only** |

`figma_activity_log_list` reports `has_more` but Figma documents no cursor to page with:
narrow the time window instead. `figma_ai_usage_daily` lags real time by 5–6 hours, so the
current day is incomplete. `figma_discovery_text_events` returns download links, one JSON
file per hour, not the events themselves. Developer log records are retained 30 days.

## Payments

| Tool | Parameters |
| --- | --- |
| `figma_payment_get` | `plugin_payment_token`, `user_id`, `community_file_id`, `plugin_id`, `widget_id` |

Two modes: a `plugin_payment_token` from `getPluginPaymentTokenAsync`, or a `user_id` plus
exactly one resource id. **Personal access token only** — the Payments API supports neither
OAuth 2 nor plan access tokens, and you can only ask about resources you own.

## oEmbed

| Tool | Parameters |
| --- | --- |
| `figma_oembed_get` | `url`, `max_width`, `max_height` |

Takes a link, not a file key. Cheaper than reading the file, and not reachable with a plan
access token.

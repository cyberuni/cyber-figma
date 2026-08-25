---
title: developer-log
description: Organization developer logs — every REST API and MCP request made against the org. Enterprise + Governance+.
sidebar:
  order: 12
---

Every REST API **and MCP server** request made against your organization — which credential
made it, from where, against what. Retained **30 days**, by both this endpoint and the UI at
`figma.com/developers/log`; nothing reaches further back. Rate limit tier 3.

:::danger[Enterprise + Governance+, org admins, plan access token only]
This is the narrowest credential requirement in the API: an **Enterprise plan with the
Governance+ add-on**, an **org admin**, and a **plan access token** — `--auth-mode plan`, scope
`org:developer_log_read`. Neither a personal access token nor OAuth reaches it.
:::

## `developer-log list`

```sh
cyber-figma developer-log list
```

Lists timestamp, event name, actor, source, and resource.

| Option | Description |
| --- | --- |
| `--token-type <type>` | `plan_access_token`, `developer_token`, or `oauth_token` |
| `--filter-token <prefix>` | Filter by token **value** prefix (comma-separated) |
| `--token-name <prefix>` | Filter by token **name** prefix (comma-separated) |
| `--user-email <prefix>` | Filter by user email prefix (comma-separated) |
| `--ip-address <prefix>` | Filter by IP address prefix (comma-separated) |
| `--event-source <source>` | `rest_api` or `mcp_server` |
| `--date-range <range>` | `last_24h`, `last_7d`, or `last_30d` |
| `--cursor <cursor>` | Where to resume |
| `--page-size <number>` | Entries per page |
| `--all` / `--max-pages <number>` | Fetch every page, up to a ceiling (default: 10) |

```sh
cyber-figma developer-log list --event-source mcp_server --date-range last_7d
cyber-figma developer-log list --user-email dev@example.com --json
cyber-figma developer-log list --token-name 'ci-,deploy-' --all
```

Every filter matches on **prefixes**, and takes a comma-separated list of them — which is what
makes `--token-name 'ci-,deploy-'` a useful way to scope a query to a naming convention.

The flag is `--filter-token`, not `--token`, because `--token` is the global credential flag.
It matches the recorded token value, which is a secret you would be putting on a command line
and into shell history — **prefer `--token-name`**.

Entries made with a plan access token have no user at all; the actor column falls back to the
token name, which is the reason to name your tokens well.

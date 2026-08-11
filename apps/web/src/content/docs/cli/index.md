---
title: CLI overview
description: The shape of the cyber-figma CLI — command grammar, global options, output formats, and pagination.
sidebar:
  order: 1
---

:::caution[Placeholder — no commands exist yet]
The per-command reference pages are **not written**, because the commands have not been
built. What follows is the CLI's agreed shape: the grammar, the global options, and the
conventions every command will follow. Each resource domain gets its own page under this
section as it lands, and
[API coverage](/cyber-figma/reference/api-coverage/) is the live status board.
:::

The `cyber-figma` CLI exposes the same operations as the
[MCP server](/cyber-figma/mcp/), without needing an agent host. Every command follows one
shape:

```sh
cyber-figma <resource> <action> [options]
```

## Planned command reference

One page per resource domain will appear here. Until then, this is the intended namespace
map, derived from the
[Figma endpoint groups](/cyber-figma/reference/api-coverage/#coverage-by-endpoint-group):

| Resource | Covers | Status |
| --- | --- | --- |
| `file` | File JSON, node JSON, image rendering, image fills, metadata, version history | 📋 Planned |
| `project` | Team projects, project metadata, project files | 📋 Planned |
| `comment` | Comments and comment reactions | 📋 Planned |
| `user` | The authenticated user | 📋 Planned |
| `component` / `component-set` / `style` | Published library content, team- and file-scoped and by key | 📋 Planned |
| `webhook` | Webhooks v2 — CRUD plus delivery inspection | 📋 Planned |
| `variable` | Local and published variables, bulk writes (**Enterprise**) | 📋 Planned |
| `dev-resource` | Dev Mode resource links | 📋 Planned |
| `analytics` | Library Analytics (**Enterprise**) | 📋 Planned |
| `activity-log` / `developer-log` / `ai-usage` / `discovery` | Org-admin reporting surfaces (**Enterprise**) | 📋 Planned |
| `payment` | Purchase validation for plugins, widgets, and Community files | 📋 Planned |
| `oembed` | oEmbed metadata for a file or published Make site | 📋 Planned |

Namespaces are the intended shape and are not final until each domain is implemented.

## Global options

These are planned to work on every command:

| Option | Description |
| --- | --- |
| `--token <token>` | Figma access token — overrides `FIGMA_ACCESS_TOKEN` |
| `--team <id>` | Team ID — overrides `FIGMA_TEAM_ID` |
| `--json` | Raw API JSON instead of formatted text |
| `--toon` | Token-efficient TOON instead of formatted text — recommended for agents |
| `--full` | Show full field values instead of truncating large text |

Output is human-readable by default. `--toon` emits
[TOON](https://github.com/kunchenguid/axi#the-10-principles), a compact tabular format that
drops repeated keys for roughly 40% fewer tokens than pretty JSON.

See [Authentication](/cyber-figma/authentication/) for how `--token` relates to
`FIGMA_ACCESS_TOKEN`, and why `FIGMA_TEAM_ID` has to exist at all.

## Figma URLs are accepted where keys are

File keys and node IDs come out of Figma URLs
(`https://www.figma.com/design/{file_key}/{title}?node-id={node_id}`), so a pasted URL is
accepted anywhere a key is.

## Pagination

Figma paginates inconsistently — [four different models](/cyber-figma/reference/api-coverage/#pagination),
plus a large set of endpoints that do not paginate at all. The CLI normalizes that: every
list command takes the same options and returns the same shape, whatever the endpoint
underneath does.

Endpoints with no pagination of their own do not gain any; they report their result as a
single complete page, which is the honest answer.

## Output conventions

Every command follows the
[10 agent-CLI principles](https://github.com/kunchenguid/axi#the-10-principles):

- **Definitive empty states** — an empty result names what was empty (`0 files found`),
  never a blank line or `(none)`.
- **Truncation with `--full`** — Figma document trees are deep, so node payloads and other
  large free-text fields are truncated with a size hint by default.
- **Minimal default schemas** — list and get commands request the smallest useful field and
  depth set when you give none. On a Tier 1 endpoint like `GET file`, a default that
  fetches the whole tree is a bug.
- **Aggregates and next steps** — list commands print a count summary and follow-up
  suggestions in text mode, suppressed under `--json` and `--toon`.
- **Non-interactive mutations** — no prompts, so everything is safe to script.
- **Idempotent deletes** — deleting something already gone succeeds rather than failing
  with a `404`.

## Errors and exit codes

Errors are structured objects under `--json` and `--toon`. `0` means success and `2` means
a usage error — an unknown flag or subcommand, reported along with the flags that command
actually accepts and a `--help` pointer. The remaining codes are documented here as the
first domain lands.

Two Figma-specific error behaviors the CLI has to translate rather than relay:

- **An expired token answers `403`, not `401`** — so "generate a new token" and "you lack
  permission on this resource" must be told apart.
- **A `429` carries the diagnosis** in `X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type`, and
  `X-Figma-Upgrade-Link`. See
  [Plans and limits](/cyber-figma/reference/plans-and-limits/#diagnosing-a-surprising-429).

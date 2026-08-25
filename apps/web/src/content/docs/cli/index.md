---
title: CLI overview
description: The shape of the cyber-figma CLI — command grammar, global options, output formats, and pagination.
sidebar:
  order: 1
---

The `cyber-figma` CLI exposes the same operations as the
[MCP server](/cyber-figma/mcp/), without needing an agent host. Every command follows one
shape:

```sh
cyber-figma <resource> <action> [options]
```

Run with no arguments, it prints its configuration — whether a credential is set, which auth
mode is active, which team id it resolved — along with the resource list and the next steps
to take. That is the fastest way for an agent to find out what it can do here.

## Resources

Fifteen resource domains, covering
[every endpoint group](/cyber-figma/reference/api-coverage/) Figma documents except SCIM and
the OAuth token endpoints. Each has its own page with every argument and option; `cyber-figma
<resource> --help` prints the same reference in the terminal.

| Resource | Covers |
| --- | --- |
| [`file`](/cyber-figma/cli/files/) | File JSON, node JSON, image rendering, image fills, metadata, version history |
| [`project`](/cyber-figma/cli/projects/) | Team projects, project metadata, project files |
| [`comment`](/cyber-figma/cli/comments/) | Comments and comment reactions |
| [`user`](/cyber-figma/cli/users/) | The authenticated user |
| [`component` / `component-set` / `style`](/cyber-figma/cli/library/) | Published library content, team- and file-scoped and by key |
| [`webhook`](/cyber-figma/cli/webhooks/) | Webhooks v2 — CRUD plus delivery inspection |
| [`variable`](/cyber-figma/cli/variables/) | Local and published variables, bulk writes (**Enterprise**) |
| [`dev-resource`](/cyber-figma/cli/dev-resources/) | Dev Mode resource links |
| [`analytics`](/cyber-figma/cli/analytics/) | Library Analytics (**Enterprise**) |
| [`activity-log`](/cyber-figma/cli/activity-logs/) / [`developer-log`](/cyber-figma/cli/developer-logs/) / [`ai-usage`](/cyber-figma/cli/ai-usage/) / [`discovery`](/cyber-figma/cli/discovery/) | Org-admin reporting surfaces (**Enterprise**) |
| [`payment`](/cyber-figma/cli/payments/) | Purchase validation for plugins, widgets, and Community files |
| [`oembed`](/cyber-figma/cli/oembed/) | oEmbed metadata for a file or published Make site |

`cyber-figma mcp` runs the [MCP server](/cyber-figma/mcp/) over stdio from the same binary.

## Global options

These work on every command:

| Option | Description |
| --- | --- |
| `--token <token>` | Figma access token — overrides `FIGMA_ACCESS_TOKEN` |
| `--team <id>` | Team id or team URL — overrides `FIGMA_TEAM_ID` |
| `--auth-mode <mode>` | How to send the token: `personal` (default), `plan`, or `oauth` |
| `--json` | Raw API JSON instead of formatted text |
| `--toon` | Token-efficient TOON instead of formatted text — recommended for agents |
| `--full` | Show full field values instead of truncating large text |

Output is human-readable by default. `--toon` emits
[TOON](https://github.com/kunchenguid/axi#the-10-principles), a compact tabular format that
drops repeated keys for roughly 40% fewer tokens than pretty JSON.

See [Authentication](/cyber-figma/authentication/) for how `--token` relates to
`FIGMA_ACCESS_TOKEN`, what each auth mode can and cannot reach, and why `FIGMA_TEAM_ID` has
to exist at all.

## Figma URLs are accepted where keys are

File keys and node IDs come out of Figma URLs
(`https://www.figma.com/design/{file_key}/{title}?node-id={node_id}`), so a pasted URL is
accepted anywhere a key is. The same holds for team and project URLs.

## Pagination

Figma paginates inconsistently — [six different models](/cyber-figma/reference/api-coverage/#pagination),
plus a large set of endpoints that do not paginate at all. The CLI normalizes that: every
list command that can page takes the same options and returns the same shape, whatever the
endpoint underneath does.

| Option | Description |
| --- | --- |
| `--cursor <cursor>` or `--before <id>` / `--after <id>` | Where to resume, in whichever form that endpoint uses |
| `--page-size <number>` | Results per page, where the endpoint accepts one |
| `--all` | Fetch every page, up to `--max-pages` |
| `--max-pages <number>` | Ceiling on `--all` (default: 10) |

A command only advertises the flags its endpoint really has: the options are derived from the
endpoint's pagination model rather than declared by hand, so there is no `--cursor` on a
command that has nowhere to send one. Endpoints with no pagination of their own do not gain
any; they report their result as a single complete page, which is the honest answer.

## Output conventions

Every command follows the
[10 agent-CLI principles](https://github.com/kunchenguid/axi#the-10-principles):

- **Definitive empty states** — an empty result names what was empty (`0 files found`),
  never a blank line or `(none)`.
- **Truncation with `--full`** — Figma document trees are deep, so node payloads and other
  large free-text fields are truncated with a size hint by default.
- **Minimal default schemas** — list and get commands request the smallest useful field and
  depth set when you give none. `file get` with no `--ids` or `--depth` returns pages only.
- **Aggregates and next steps** — list commands print a count summary and follow-up
  suggestions in text mode, suppressed under `--json` and `--toon`.
- **Non-interactive mutations** — no prompts, so everything is safe to script.
- **Idempotent deletes** — deleting something already gone succeeds and reports
  `already_absent` rather than failing with a `404`.

## Errors and exit codes

Errors are structured objects under `--json` and `--toon`. Agents can branch on the exit
code:

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Error |
| `2` | Usage error — unknown flag or subcommand, reported with the flags that command accepts |
| `3` | Auth or configuration problem — no credential, or no team id to resolve |
| `4` | Forbidden — the credential is valid but lacks permission |
| `5` | Not found |
| `6` | Rate limited |
| `7` | Above the plan level — the endpoint needs a higher plan, seat, or role |

Two Figma-specific error behaviors the CLI translates rather than relays:

- **An expired token answers `403`, not `401`** — so "generate a new token" and "you lack
  permission on this resource" have to be told apart, and the message says which one it is.
- **A `429` carries the diagnosis** in `X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type`, and
  `X-Figma-Upgrade-Link`. See
  [Plans and limits](/cyber-figma/reference/plans-and-limits/#diagnosing-a-surprising-429).

---
title: component, component-set, style
description: Published library content — components, component sets, and styles, by team, by file, or by key.
sidebar:
  order: 6
---

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

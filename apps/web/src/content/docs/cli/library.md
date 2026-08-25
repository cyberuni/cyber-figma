---
title: component, component-set, style
description: Published library content — components, component sets, and styles, by team, by file, or by key.
sidebar:
  order: 6
---

Three families with identical shapes. Whatever holds for `component` holds for `component-set`
and `style`, with the noun swapped; styles carry one extra field, `style_type`.

| Command | Scope required |
| --- | --- |
| [`<resource> team-list [team]`](#team-list) | `team_library_content:read` |
| [`<resource> file-list <file>`](#file-list) | `library_content:read` |
| [`<resource> get <key>`](#get) | `library_assets:read` |

:::caution[Published content only]
These endpoints return **published library content**, not every component or style in a file.
A component that exists in a file but was never published to a library does not appear here at
all, and no REST endpoint publishes one — publishing is a UI or plugin action.
:::

All nine commands are rate limit tier 3, the cheapest.

## `team-list`

```sh
cyber-figma component team-list [team]
cyber-figma component-set team-list [team]
cyber-figma style team-list [team]
```

A team's published library content, as `key`, `name`, `file_key`, `node_id`, `updated_at` —
plus `style_type` for styles. The team argument takes a team id or a team URL and falls back to
`--team`, then `FIGMA_TEAM_ID`.

| Option | Description |
| --- | --- |
| `--page-size <number>` | Results per page (default: 30; components documents a maximum of 1000, above which values are capped) |
| `--before <id>` / `--after <id>` | Where to resume; mutually exclusive |
| `--all` | Fetch every page, up to `--max-pages` |
| `--max-pages <number>` | Ceiling on `--all` (default: 10) |

```sh
cyber-figma component team-list --page-size 100
cyber-figma style team-list --all --max-pages 5
cyber-figma component-set team-list 1234567890 --after 30
```

These three advance with `--after` (or `--before`), **not `--cursor`**: the cursor here is an
opaque integer bound Figma tracks internally, not a real id and not a page number. The next
steps printed after a page name the exact `--after` to use.

## `file-list`

```sh
cyber-figma component file-list <file>
cyber-figma component-set file-list <file>
cyber-figma style file-list <file>
```

What one file publishes. Not paginated — the whole set comes back at once.

:::caution[Main file keys only]
`file-list` needs a **main file key, not a branch key**, because branches cannot publish. Get
one from [`project files`](/cyber-figma/cli/projects/#project-files), or from
[`file get --branch-data`](/cyber-figma/cli/files/#file-get) if you have a branch and need its
parent.
:::

## `get`

```sh
cyber-figma component get <key>
cyber-figma component-set get <key>
cyber-figma style get <key>
```

One published item by its **library key** — the `key` column from either list command, **not a
node id**. Returns the name, description, the file key and node id it lives at, when it was
created and last updated, who updated it, and a thumbnail URL. Styles also report
`style_type`.

The `file_key` and `node_id` in the result are the bridge back into the file: pass them to
[`file nodes`](/cyber-figma/cli/files/#file-nodes) to read the actual geometry — remembering
that is a tier-1 call.

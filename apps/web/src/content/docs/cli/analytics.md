---
title: analytics
description: Library Analytics for a published library file — component, style, and variable actions and usages. Enterprise plan.
sidebar:
  order: 10
---

Library Analytics: who inserts and detaches your published library assets, and where those
assets are in use. The file argument is always the **published library file**, by key or URL.

:::danger[Enterprise plan]
Library Analytics needs an **Enterprise** plan and the `library_analytics:read` scope. Unlike
the other Enterprise domains here, it works with a personal access token, a plan token, or
OAuth.
:::

Six commands, one per (asset, metric) pair:

| Command | `--group-by` | Date range |
| --- | --- | --- |
| `analytics component-actions <file>` | `component` \| `team` | yes |
| `analytics component-usages <file>` | `component` \| `file` | no |
| `analytics style-actions <file>` | `style` \| `team` | yes |
| `analytics style-usages <file>` | `style` \| `file` | no |
| `analytics variable-actions <file>` | `variable` \| `team` | yes |
| `analytics variable-usages <file>` | `variable` \| `file` | no |

`--group-by` is **required** on all six, and only accepts the two values in its row — that is
Figma's constraint, and the CLI rejects anything else before spending the call.

## `-actions`: a weekly time series

```sh
cyber-figma analytics component-actions <file> --group-by component
```

Insertions and detachments, week by week.

| Option | Description |
| --- | --- |
| `--group-by <dimension>` | **Required.** `component`/`style`/`variable`, or `team` |
| `--start-date <YYYY-MM-DD>` | Earliest week to include — rounded **back** to a week start |
| `--end-date <YYYY-MM-DD>` | Latest week to include — rounded **forward** to a week end |
| `--cursor <cursor>` | Where to resume |
| `--all` / `--max-pages <number>` | Fetch every page, up to a ceiling (default: 10) |

```sh
cyber-figma analytics component-actions abc123 --group-by team \
  --start-date 2026-01-01 --end-date 2026-03-31
cyber-figma analytics style-actions abc123 --group-by style --all --json
```

Dates are whole weeks, not days: whatever you pass is widened outward to week boundaries. With
no range at all, Figma returns the prior year up to the latest computed week.

## `-usages`: a snapshot

```sh
cyber-figma analytics component-usages <file> --group-by component
```

Where assets are in use **right now**. These take no date range at all — there is no time
dimension to filter — so `--start-date` and `--end-date` are not offered, and passing one is an
unknown-flag usage error that exits `2`.

| Option | Description |
| --- | --- |
| `--group-by <dimension>` | **Required.** `component`/`style`/`variable`, or `file` |
| `--cursor <cursor>` | Where to resume |
| `--all` / `--max-pages <number>` | Fetch every page, up to a ceiling (default: 10) |

## Reading the results

Row shape differs per grouping dimension, so the table columns come from the rows Figma
actually sent rather than a fixed list. Text mode shows the first 60 rows and says how many it
withheld; `--full`, `--json`, or `--toon` give you all of them.

Three semantics worth knowing before you build on this data:

- **Recomputed daily at 00:00 UTC.** Polling more often gains nothing.
- **Rows you lack permission for are obfuscated, not dropped** — they come back named
  `Team not visible` or `File not visible`. They are many different entities wearing one name,
  so aggregating them as a single team or file is wrong.
- **Usage outside your organization is excluded entirely**, so these numbers are an internal
  adoption measure, not a total.

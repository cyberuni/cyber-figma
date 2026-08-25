---
title: analytics
description: Library Analytics for a published library file — component, style, and variable actions and usages. Enterprise plan.
sidebar:
  order: 10
---

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

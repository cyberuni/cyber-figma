---
title: file
description: "Read a Figma file: document tree, nodes, image renders, image fills, metadata, and version history."
sidebar:
  order: 2
---

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

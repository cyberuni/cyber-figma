---
title: file
description: "Read a Figma file: document tree, nodes, image renders, image fills, metadata, and version history."
sidebar:
  order: 2
---

Everything that reads a file. A file is addressed by its **file key**, which you can paste as
a URL — `https://www.figma.com/design/{file_key}/{title}` — or pass as the bare key. Most of
these accept a **branch key** as well as a main file key.

| Command | What it does | Rate limit tier |
| --- | --- | --- |
| [`file get`](#file-get) | The file's document tree | **1** |
| [`file nodes`](#file-nodes) | The document of specific nodes | **1** |
| [`file images`](#file-images) | Render nodes to image URLs | **1** |
| [`file image-fills`](#file-image-fills) | Download URLs for images used as fills | 2 |
| [`file versions`](#file-versions) | Version history | 2 |
| [`file meta`](#file-meta) | Metadata without the document | 3 |

:::caution[Three of these are Figma's most expensive calls]
`file get`, `file nodes`, and `file images` are tier 1, and a View or Collab seat is allowed
roughly **6 tier-1 calls per month**. Reach for `file meta` when you only need to know what a
file is, and see [Plans and limits](/cyber-figma/reference/plans-and-limits/) for the full
tier table.
:::

## `file get`

```sh
cyber-figma file get <file>
```

Returns the document tree, plus the file's name, version, role, editor type, and last-modified
time. In text mode it prints those fields, a table of the file's pages, and the (truncated)
document payload; `--json` returns Figma's response unchanged.

| Option | Description |
| --- | --- |
| `--ids <ids>` | Only these node ids (comma-separated; dashed URL ids accepted). Returns those nodes, their children, and everything between them and the root |
| `--depth <n\|all>` | Tree depth: `1` = pages, `2` = pages and their top-level objects, `all` = whole tree |
| `--version <id>` | A specific version id, from [`file versions`](#file-versions) (default: the current version) |
| `--geometry` | Include vector geometry as paths |
| `--plugin-data <ids>` | Comma-separated plugin ids and/or the string `shared`; populates `pluginData` and `sharedPluginData` |
| `--branch-data` | Include branch metadata — **the only way to obtain a branch key** |

```sh
cyber-figma file get https://www.figma.com/design/abc123/My-File   # pages only
cyber-figma file get abc123 --depth 2                              # pages and their top-level objects
cyber-figma file get abc123 --ids 1:2,1:7 --geometry
cyber-figma file get abc123 --branch-data --json | jq '.branches'
```

With neither `--ids` nor `--depth`, `file get` asks for pages only (depth 1). That default is
deliberate: on a tier-1 endpoint, an unbounded request that walks the whole tree is a bug.
Large files also commonly time out with a `400` or `500` when asked for everything — narrowing
with `--depth` and `--ids` is the fix, not retrying.

The `version` field in the response increments on every modification, so comparing it is a
cheap change check that costs no tier-1 call when taken from
[`file meta`](#file-meta) instead.

## `file nodes`

```sh
cyber-figma file nodes <file> --ids <ids>
```

The same document data, scoped to specific nodes. `--ids` is required — that is the difference
from `file get`, which can be asked for a whole file.

| Option | Description |
| --- | --- |
| `--ids <ids>` | **Required.** Node ids (comma-separated; dashed URL ids accepted) |
| `--depth <n\|all>` | How deep to traverse from each node (default: the whole subtree) |
| `--version <id>` | A specific version id (default: the current version) |
| `--geometry` | Include vector geometry as paths |
| `--plugin-data <ids>` | Comma-separated plugin ids and/or the string `shared` |

```sh
cyber-figma file nodes abc123 --ids 1:2
cyber-figma file nodes 'https://www.figma.com/design/abc123/My-File?node-id=1-2' --ids 1-2
cyber-figma file nodes abc123 --ids 1:2,1:7 --depth 1
```

The result is keyed by the node ids you asked for. Figma also returns an `err` field on this
endpoint that its own OpenAPI specification omits; `--json` passes it through.

## `file images`

```sh
cyber-figma file images <file> --ids <ids>
```

Renders nodes and returns URLs. This is a **render**, not a download of stored assets — the
image is produced on demand, at the format and scale you ask for.

| Option | Description |
| --- | --- |
| `--ids <ids>` | **Required.** Node ids to render in **one** call — batching is how Figma says to avoid rate limits |
| `--format <format>` | `jpg`, `png`, `svg`, or `pdf` (default: `png`) |
| `--scale <number>` | Render scale, `0.01`–`4` |
| `--version <id>` | A specific version id |
| `--svg-outline-text` | Render text as vector paths instead of `<text>` elements |
| `--svg-include-id` | Add the layer name to each element's `id` attribute |
| `--svg-include-node-id` | Add the node id to each element's `data-node-id` attribute |
| `--svg-simplify-stroke` | Use stroke attributes instead of `<mask>` where possible |
| `--contents-only` | Exclude overlapping content (leaving it off is slower) |
| `--use-absolute-bounds` | Use full node dimensions, ignoring cropping — how to export text without it being cut off |

```sh
cyber-figma file images abc123 --ids 1:2,1:7,1:9 --format svg --svg-outline-text
cyber-figma file images abc123 --ids 1:2 --format png --scale 2
```

A **`null` URL means that node did not render** — a bad id, or nothing renderable there. The
call itself succeeded, so retrying returns the same answer. Every id you asked for appears in
the result either way, and the text output names the ones that failed.

Rendered URLs **expire 30 days** after rendering, and images are capped at 32 megapixels —
anything larger is scaled down. Download what you need rather than storing the URL.

## `file image-fills`

```sh
cyber-figma file image-fills <file>
```

Download links for every user-supplied image used as a fill in the document. Takes no options
beyond the [global ones](/cyber-figma/cli/#global-options).

The `image_ref` keys match the `imageRef` field on `Paint` objects in
[`file get`](#file-get) output, which is how you connect a fill in the tree to its source
image. These URLs **expire after at most 14 days** — sooner than rendered ones.

## `file meta`

```sh
cyber-figma file meta <file>
```

Metadata without the document: name, containing folder (project), editor type, role, link
access, version, who last touched it and when, the creator, and the file URL. **Tier 3, the
cheapest tier** — use it for any listing or inspection flow.

The `editorType` here has a wider range than on [`file get`](#file-get) — `figma`, `figjam`,
`slides`, `buzz`, `sites`, or `make` — because this endpoint describes files `file get` cannot
open.

## `file versions`

```sh
cyber-figma file versions <file>
```

Version history: id, creation time, label, description, and the user behind each entry. Feed
an id back into `file get --version <id>` to read the file as it was.

| Option | Description |
| --- | --- |
| `--page-size <number>` | Versions per page (default: 30) |
| `--before <id>` / `--after <id>` | Versions before or after this version id |
| `--all` | Fetch every page, up to `--max-pages` |
| `--max-pages <number>` | Ceiling on `--all` (default: 10) |

```sh
cyber-figma file versions abc123 --page-size 10
cyber-figma file versions abc123 --all --max-pages 3
```

`label` and `description` are `null` on versions that were never named.

---
title: dev-resource
description: Dev Mode resources — the developer links attached to file nodes.
sidebar:
  order: 9
---

Dev resources are developer-contributed URLs attached to nodes and surfaced in **Dev Mode** —
the link from a frame to the ticket, the PR, or the component in your codebase.

| Command | What it does |
| --- | --- |
| [`dev-resource list`](#dev-resource-list) | The links attached to a file |
| [`dev-resource create`](#dev-resource-create) | Attach a link to one or more nodes |
| [`dev-resource update`](#dev-resource-update) | Rename a link or retarget its URL |
| [`dev-resource delete`](#dev-resource-delete) | Remove a link |

Unlike variables, components, and styles, dev resources **need no publish step** — a link is
live the moment it is written, including on already-published components.

Reading needs any file access; writing needs edit access. A node holds at most **10 links**,
and two links on the same node may not share a URL.

:::caution[Main file keys only]
Every command here takes a **main file key, never a branch key**.
:::

:::note[The REST endpoints carry no plan gate, but the surface does]
Dev Mode is available on paid plans and needs a Full or a Dev seat. On a plan or seat without
it, these calls still succeed — the links simply are not visible in the product.
:::

## `dev-resource list`

```sh
cyber-figma dev-resource list <file>
```

Lists id, node, name, and URL for every dev resource in the file.

| Option | Description |
| --- | --- |
| `--node-ids <ids>` | Only dev resources on these nodes (comma-separated; default: the whole file) |

```sh
cyber-figma dev-resource list abc123
cyber-figma dev-resource list abc123 --node-ids 1:2,1:7
```

## `dev-resource create`

```sh
cyber-figma dev-resource create <file> --node <ids> --name <name> --url <url>
```

| Option | Description |
| --- | --- |
| `--node <ids>` | **Required.** Node ids to attach the link to (comma-separated) |
| `--name <name>` | **Required.** Display name of the link |
| `--url <url>` | **Required.** URL the link points at |

```sh
cyber-figma dev-resource create abc123 --node 1:2 \
  --name 'Checkout PR' --url https://github.com/acme/web/pull/812
cyber-figma dev-resource create abc123 --node 1:2,1:7,1:9 \
  --name 'Storybook' --url https://storybook.acme.dev
```

Passing several node ids attaches the same link to each of them in one call.

## `dev-resource update`

```sh
cyber-figma dev-resource update <dev-resource-id>
```

Takes the dev resource id from [`dev-resource list`](#dev-resource-list) — not a file key and
not a node id.

| Option | Description |
| --- | --- |
| `--name <name>` | New display name |
| `--url <url>` | New URL |

## `dev-resource delete`

```sh
cyber-figma dev-resource delete <file> <dev-resource-id>
```

Idempotent: deleting a link that is already gone succeeds and reports `already_absent`.

## Partial success on writes

:::caution[A 200 is not proof of success]
`create` and `update` are bulk writes, and Figma answers `200` **even when some items failed**.
:::

The result reports `ok`, `requested`, `succeeded`, `failed`, and an `errors` array, and text
output prints every rejection by name. The command exits nonzero only when **nothing** was
written — a partial write is a success with a report, so check the counts rather than the exit
code alone.

Documented causes of a per-item failure: the file key is not found, the node already holds the
maximum of 10 dev resources, or another dev resource on the same node already has that URL.

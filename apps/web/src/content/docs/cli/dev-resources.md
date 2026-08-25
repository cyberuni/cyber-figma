---
title: dev-resource
description: Dev Mode resources — the developer links attached to file nodes.
sidebar:
  order: 9
---

Dev Mode resources — developer links attached to file nodes.

| Command | Options |
| --- | --- |
| `dev-resource list <file>` | `--node-ids <ids>` |
| `dev-resource create <file>` | `--node <ids>`, `--name <name>`, `--url <url>` |
| `dev-resource update <dev-resource-id>` | `--name <name>`, `--url <url>` |
| `dev-resource delete <file> <dev-resource-id>` | — |

Dev resources are live immediately — unlike variables, components, and styles, they need no
publish step. Every one of these commands needs a **main file key, not a branch key**.

:::caution[A 200 is not proof of success]
Create and update have partial-success semantics: Figma answers `200` even when some items
fail. Read `ok`, `succeeded`, `failed`, and `errors` in the result. Documented causes are an
unknown file key, a node already holding the maximum of 10 dev resources, and a duplicate URL
on the same node.
:::

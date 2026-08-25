---
title: variable
description: Read local and published variables and apply bulk changes. Enterprise plan.
sidebar:
  order: 8
---

Variables and variable collections in a file.

:::danger[Enterprise, for reads as well as writes]
The whole Variables API is gated to the **Enterprise** plan — not just the write. Writing
additionally needs a Full seat or admin, Edit access on the file, and a credential that is
**not** a plan access token. A refusal here comes back as exit code `7`, above the plan level,
rather than as an ordinary permission error.
:::

| Command | What it does |
| --- | --- |
| [`variable list`](#variable-list) | The variables in a file |
| [`variable collections`](#variable-collections) | The variable collections in a file |
| [`variable get`](#variable-get) | One variable, with its value in every mode |
| [`variable apply`](#variable-apply) | Create, update, and delete in one batch |

Every read command has a `--published` switch, and the two views are genuinely different data:

| | Local (default) | Published (`--published`) |
| --- | --- | --- |
| File key | File key **or branch key** | **Main file key only** |
| Modes | Present — the only place mode values are readable | **Omitted entirely** |
| Ids | `id`, stable within the file | Adds `subscribed_id`, which **changes on every republish** |
| Contents | Variables created in the file, plus remote ones used in it | What the file publishes to other files |

Reads are rate limit tier 2; `variable apply` is tier 3 — the write is the *cheaper* call
here, which is unusual for Figma.

## `variable list`

```sh
cyber-figma variable list <file>
```

Lists id, name, resolved type, collection, and how many modes each variable carries a value
for.

| Option | Description |
| --- | --- |
| `--published` | Read the published library variables instead of the local ones (main file key only) |
| `--collection <id>` | Only the variables in this collection |

```sh
cyber-figma variable list abc123
cyber-figma variable list abc123 --collection 'VariableCollectionId:1:2'
cyber-figma variable list abc123 --published --toon
```

## `variable collections`

```sh
cyber-figma variable collections <file>
```

Lists id, name, the mode names, and how many variables each collection holds. Under
`--published` the modes column says so rather than showing an empty cell — the published view
has no modes to report.

| Option | Description |
| --- | --- |
| `--published` | Read the published library collections instead of the local ones |

## `variable get`

```sh
cyber-figma variable get <file> <variable-id>
```

One variable in full: name, key, resolved type, collection, description, scopes, whether it is
remote, whether it is hidden from publishing, and — in the local view — **its value in every
mode**, printed one line per mode.

| Option | Description |
| --- | --- |
| `--published` | Read the published library variables instead of the local ones |

```sh
cyber-figma variable get abc123 'VariableID:1:2'
```

This is how you resolve the `variableId` a node carries in `boundVariables` in
[`file get`](/cyber-figma/cli/files/#file-get) output — the tree tells you a fill is bound to a
variable, and this tells you which one and what it evaluates to.

## `variable apply`

```sh
cyber-figma variable apply <file> --changes @changes.json --dry-run
```

Creates, updates, and deletes variables, collections, modes, and mode values in **one batch
request**.

| Option | Description |
| --- | --- |
| `--changes <json\|@path>` | **Required.** The change set: JSON inline, or `@<path>` to read it from a file |
| `--dry-run` | Validate the change set and report what it would touch, without sending it |

The change set is a JSON object with any of four keys, **applied in this order**, and in array
order within each:

1. `variableCollections` — create, update, delete collections
2. `variableModes` — modes within collections (max **40 modes** per collection; mode names ≤ 40 characters)
3. `variables` — the variables themselves (max **5000 per collection**; names unique within a collection, and no `.{}` characters)
4. `variableModeValues` — a value for one (variable, mode) pair

```json
{
  "variableCollections": [
    { "action": "CREATE", "id": "tmp_collection", "name": "Brand" }
  ],
  "variables": [
    {
      "action": "CREATE",
      "id": "tmp_primary",
      "name": "color/primary",
      "variableCollectionId": "tmp_collection",
      "resolvedType": "COLOR"
    }
  ]
}
```

A `CREATE` may carry a **temporary id** that later entries reference, as above; the response
maps each temporary id to the real one Figma assigned, and the CLI prints that mapping.

```sh
cyber-figma variable apply abc123 --changes @changes.json --dry-run   # validate first
cyber-figma variable apply abc123 --changes @changes.json
```

Run `--dry-run` first. It parses and validates the change set locally and reports the counts it
would touch, without sending anything — the API has no undo, so a typo caught here is a typo
that never happened.

:::caution[REST cannot publish]
Changes are visible only in that file until the library is published, and **publishing is a UI
or plugin action with no REST equivalent**. Nothing in this CLI, or in Figma's API, makes a
variable change visible to consuming files on its own.
:::

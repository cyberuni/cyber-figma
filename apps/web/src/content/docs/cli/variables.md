---
title: variable
description: Read local and published variables and apply bulk changes. Enterprise plan.
sidebar:
  order: 8
---

Variables and variable collections. **Enterprise plan, for reads as well as writes.**

| Command | Options |
| --- | --- |
| `variable list <file>` | `--published`, `--collection <id>` |
| `variable collections <file>` | `--published` |
| `variable get <file> <variable-id>` | `--published` |
| `variable apply <file>` | `--changes <json\|@path>`, `--dry-run` |

The local view is the only place mode values are readable; the published view omits modes.
`variable get` is how you resolve the `variableId` a node carries in `boundVariables`.

`variable apply` creates, updates, and deletes variables, collections, modes, and mode values
in one batch. `--changes` takes JSON inline or `@<path>` to read it from a file, with the
keys `variableCollections`, `variableModes`, `variables`, and `variableModeValues` — applied
in that order. A `CREATE` may carry a temporary id that later entries reference, and the
response maps those to real ids. Run it with `--dry-run` first: it validates the change set
and reports what it would touch without sending anything.

:::caution[REST cannot publish]
Changes are visible only in that file until the library is published, and publishing is a UI
or plugin action with no REST equivalent. Writing also needs a Full seat or admin, Edit
access on the file, and a credential that is **not** a plan access token.
:::

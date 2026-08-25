---
title: project
description: List a team's projects and the files inside them — the discovery path to a file key.
sidebar:
  order: 3
---

This is the discovery path. A team id leads to projects, a project leads to files, and a file
gives you the **file key** every [`file`](/cyber-figma/cli/files/) command takes.

Figma has no endpoint that discovers a team id from a token — its docs say so outright — which
is why [`FIGMA_TEAM_ID`](/cyber-figma/authentication/) exists. Read the id out of your team's
URL (the segment after `/team/`) once, and every team-scoped command stops needing an argument.

| Command | What it does | Rate limit tier |
| --- | --- | --- |
| [`project list`](#project-list) | The projects in a team | 2 |
| [`project get`](#project-get) | One project's metadata | 3 |
| [`project files`](#project-files) | The files in a project | 2 |

## `project list`

```sh
cyber-figma project list [team]
```

Lists the projects of a team as `id` and `name`. The team argument takes a **team id or a team
URL**; leave it off and the CLI falls back to `--team`, then `FIGMA_TEAM_ID`, then a team id
committed in [`.agents/cyber-figma.json`](/cyber-figma/authentication/). With none of those,
the command fails with a message telling you where in the Figma URL to find the id, rather
than guessing at one.

```sh
cyber-figma project list
cyber-figma project list 1234567890
cyber-figma project list https://www.figma.com/files/team/1234567890/My-Team
```

Only projects visible to the authenticated credential come back, so an empty result is a
permissions answer as often as it is an empty team. The endpoint returns everything in one
response — there is nothing to page through.

## `project get`

```sh
cyber-figma project get <project>
```

One project's metadata: id, name, file count, creation and update times, and a thumbnail URL.
Takes a project id or a project URL. Tier 3, so this is the cheap way to check whether a
project is worth listing.

## `project files`

```sh
cyber-figma project files <project>
```

The files in a project, as `key`, `name`, and `last modified`. The `key` column is what you
pass to every `file` command.

| Option | Description |
| --- | --- |
| `--branch-data` | Include branch metadata for each main file that has branches |

```sh
cyber-figma project files 987654
cyber-figma project files 987654 --branch-data --json
```

:::note[`--branch-data` output is not in Figma's spec]
Figma documents the parameter as returning "branch metadata in the response for each main file
with a branch inside the project", but publishes no response type for what it adds. The extra
fields survive into `--json` output as-is; nothing here invents a shape for them. To obtain a
**branch key**, use [`file get --branch-data`](/cyber-figma/cli/files/#file-get).
:::

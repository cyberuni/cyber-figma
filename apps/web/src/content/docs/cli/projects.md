---
title: project
description: List a team's projects and the files inside them — the discovery path to a file key.
sidebar:
  order: 3
---

Projects in a team, and the files inside them.

| Command | Options |
| --- | --- |
| `project list [team]` | Team id or URL; defaults to `--team`, then `FIGMA_TEAM_ID` |
| `project get <project>` | — |
| `project files <project>` | `--branch-data` includes branch metadata for each main file that has branches |

This is the discovery path: a team id leads to projects, projects to files, and a file to the
file key every `file` command takes. Figma has no endpoint that discovers a team id from a
token, which is why [`FIGMA_TEAM_ID`](/cyber-figma/authentication/) exists.

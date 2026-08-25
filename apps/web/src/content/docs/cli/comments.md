---
title: comment
description: Read, post, and delete file comments, and manage reactions on them.
sidebar:
  order: 4
---

Comments on a file, and reactions to them.

| Command | Options |
| --- | --- |
| `comment list <file>` | `--as-md`, `--thread <comment-id>` |
| `comment create <file>` | `--message <text>`, `--reply-to <comment-id>`, `--node-id <id>`, `--x`, `--y`, `--region-width`, `--region-height`, `--pin-corner <corner>` |
| `comment delete <file> <comment-id>` | — |
| `comment reaction list <file> <comment-id>` | `--cursor`, `--all`, `--max-pages` |
| `comment reaction add <file> <comment-id>` | `--emoji <shortcode>` |
| `comment reaction delete <file> <comment-id>` | `--emoji <shortcode>` |

`comment list` returns root comments and replies in one flat list; a reply carries
`parent_id`. A reply must target a **root** comment — you cannot reply to a reply. With
`--node-id`, `--x` / `--y` are the offset from that frame's top-left corner rather than
canvas coordinates.

Only the author may delete a comment, and only the person who left a reaction may remove it.
`--emoji` takes an emoji shortcode, such as `:heart:` or `:+1::skin-tone-2:`. Comment writes
are **not available with a plan access token**.

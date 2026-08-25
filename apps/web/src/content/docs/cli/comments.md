---
title: comment
description: Read, post, and delete file comments, and manage reactions on them.
sidebar:
  order: 4
---

Comments on a file, and reactions to them. Every command takes a **file key or a Figma file
URL** as its first argument.

| Command | What it does |
| --- | --- |
| [`comment list`](#comment-list) | The comments on a file |
| [`comment create`](#comment-create) | Post a comment, a reply, or a pinned comment |
| [`comment delete`](#comment-delete) | Delete a comment you authored |
| [`comment reaction list`](#comment-reaction-list) | The reactions on a comment |
| [`comment reaction add`](#comment-reaction-add) | React to a comment |
| [`comment reaction delete`](#comment-reaction-delete) | Remove your own reaction |

:::caution[Writes need a user credential]
Posting comments requires the `file_comments:write` scope and is **not available with a plan
access token**. Reads are fine in any auth mode.
:::

## `comment list`

```sh
cyber-figma comment list <file>
```

Lists id, author, state (`open` or `resolved`), what it replies to, and the message.

| Option | Description |
| --- | --- |
| `--as-md` | Return comment bodies as markdown where applicable |
| `--thread <comment-id>` | Only this root comment and its replies |

```sh
cyber-figma comment list abc123
cyber-figma comment list abc123 --thread 987 --as-md
cyber-figma comment list abc123 --toon
```

Figma returns root comments and replies as **one flat list**, with a reply carrying
`parent_id` — hence the `reply to` column, and `--thread` for reading a single conversation.
The endpoint has no pagination: every comment on the file comes back in one response.

Message bodies are truncated with a size hint; pass `--full` for the whole text.

## `comment create`

```sh
cyber-figma comment create <file> --message <text>
```

| Option | Description |
| --- | --- |
| `--message <text>` | **Required.** The comment text |
| `--reply-to <comment-id>` | Reply to this comment — it must be a **root** comment |
| `--node-id <id>` | Pin inside this frame; `--x` / `--y` become the offset from its top-left corner |
| `--x <number>` | X position on the canvas, or inside the frame with `--node-id` |
| `--y <number>` | Y position on the canvas, or inside the frame with `--node-id` |
| `--region-width <number>` | Make it a region comment this wide (with `--region-height`) |
| `--region-height <number>` | Make it a region comment this tall (with `--region-width`) |
| `--pin-corner <corner>` | Which corner of a region carries the pin: `top-left`, `top-right`, `bottom-left`, `bottom-right` |

```sh
cyber-figma comment create abc123 --message "Spacing looks off here"
cyber-figma comment create abc123 --message "Agreed" --reply-to 987
cyber-figma comment create abc123 --message "This frame" --node-id 1:2 --x 24 --y 40
cyber-figma comment create abc123 --message "This area" --x 100 --y 200 \
  --region-width 320 --region-height 180 --pin-corner top-left
```

Where the comment lands is decided by which options you give: none at all makes an unpinned
file comment, `--x`/`--y` pins it on the canvas, adding `--node-id` makes those coordinates an
offset inside that frame, and adding the region size makes it a region comment.

**You cannot reply to a reply.** `--reply-to` must name a root comment; Figma rejects a
reply whose target already has a `parent_id`.

## `comment delete`

```sh
cyber-figma comment delete <file> <comment-id>
```

**Only the author of a comment may delete it** — no admin override exists in the API. The
delete is idempotent: deleting a comment that is already gone succeeds and reports
`already_absent` instead of failing with a `404`.

## `comment reaction list`

```sh
cyber-figma comment reaction list <file> <comment-id>
```

Lists emoji, user, and creation time.

| Option | Description |
| --- | --- |
| `--cursor <cursor>` | Where to resume |
| `--all` | Fetch every page, up to `--max-pages` |
| `--max-pages <number>` | Ceiling on `--all` (default: 10) |

This is one of the few genuinely paginated read endpoints in the Figma API.

## `comment reaction add`

```sh
cyber-figma comment reaction add <file> <comment-id> --emoji <shortcode>
```

`--emoji` is required and takes an **emoji shortcode**, not a literal emoji character:

```sh
cyber-figma comment reaction add abc123 987 --emoji :+1:
cyber-figma comment reaction add abc123 987 --emoji ':+1::skin-tone-2:'
cyber-figma comment reaction add abc123 987 --emoji :heart:
```

Quote a shortcode containing `:` pairs so your shell does not mangle it.

## `comment reaction delete`

```sh
cyber-figma comment reaction delete <file> <comment-id> --emoji <shortcode>
```

Removes one reaction, identified by its shortcode — **only the person who left a reaction may
remove it**. Idempotent, like every delete here.

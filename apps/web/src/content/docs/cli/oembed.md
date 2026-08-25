---
title: oembed
description: Describe a Figma file or published Make URL as an embeddable oEmbed resource.
sidebar:
  order: 16
---

Describes a Figma file or published Make URL as an embeddable resource, following the
[oEmbed 1.0 spec](https://oembed.com/). Scope `file_metadata:read`.

It takes a **link, not a file key**, and it is much cheaper than reading the file — this is the
right call for building a link preview, and a way to get a file's title and thumbnail without
spending a tier-1 request.

:::caution[Not reachable with a plan access token]
Use a personal access token or OAuth.
:::

## `oembed get`

```sh
cyber-figma oembed get <url>
```

| Option | Description |
| --- | --- |
| `--max-width <pixels>` | Maximum embed width (default: 800) |
| `--max-height <pixels>` | Maximum embed height (default: 450) |

```sh
cyber-figma oembed get https://www.figma.com/design/abc123/My-File
cyber-figma oembed get https://my-site.figma.site --max-width 1200
cyber-figma oembed get https://www.figma.com/design/abc123/My-File --json
```

Both dimensions are adjusted to preserve a **16:9** ratio, so asking for an off-ratio box gives
you the nearest one that fits.

The result carries the title, the file key, the provider (`Figma` or `Make`), the containing
folder, the size, a thumbnail URL, and the `html` iframe markup. The markup is by far the
largest field and is truncated in text mode — use `--full` or `--json` when you want to paste
it somewhere.

A **published Make site has no file key**, so the `key` field is absent for those. When there
is one, it is the key every [`file`](/cyber-figma/cli/files/) command takes.

This is also the one endpoint in Figma's specification that can answer **`501 Not
Implemented`**, so a client branching on status codes should expect it here and nowhere else.

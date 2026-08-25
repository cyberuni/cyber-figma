---
title: oembed
description: Describe a Figma file or published Make URL as an embeddable oEmbed resource.
sidebar:
  order: 16
---

| Command | Options |
| --- | --- |
| `oembed get <url>` | `--max-width <pixels>`, `--max-height <pixels>` |

Describes a Figma file or published Make URL as an embeddable resource
([oEmbed 1.0](https://oembed.com/)): title, thumbnail, file key, and iframe HTML. It takes a
**link, not a file key**, is cheaper than reading the file, and is not reachable with a plan
access token. Sizes default to 800×450 and are adjusted to keep 16:9.

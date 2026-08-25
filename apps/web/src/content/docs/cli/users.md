---
title: user
description: Identify the account the current credential belongs to.
sidebar:
  order: 5
---

| Command | What it does |
| --- | --- |
| `user me` | The account the current credential belongs to |

The connection check for a personal access token or OAuth. It is **not reachable with a plan
access token**, so in that mode check the connection with something else, such as
`project list`.

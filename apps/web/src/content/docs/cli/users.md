---
title: user
description: Identify the account the current credential belongs to.
sidebar:
  order: 5
---

One command, and the fastest way to confirm a credential works.

## `user me`

```sh
cyber-figma user me
```

Prints the id, handle, email, and avatar URL of the account the current credential belongs to.
The `email` field appears on this endpoint and nowhere else in the Figma API. Tier 3, and it
needs the `current_user:read` scope.

:::caution[Not reachable with a plan access token]
Plan access tokens are not tied to a user, so `user me` fails in `--auth-mode plan`. Check the
connection with something team-scoped instead — `cyber-figma project list` is a good
substitute, and running `cyber-figma` with no arguments reports the configuration without
spending a call at all.
:::

Knowing who you are does not tell you which team to walk: there is no endpoint that maps a
token to a team id. See [`project list`](/cyber-figma/cli/projects/#project-list) for where the
team id comes from.

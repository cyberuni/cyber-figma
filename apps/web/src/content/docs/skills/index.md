---
title: Agent skills
description: The workflow skills cyber-figma ships for Claude Code, Cursor, and other agents.
sidebar:
  order: 1
---

`cyber-figma` ships workflow skills for Claude Code, Cursor, and other agents. **Start
here** — skills encode when to reach for an MCP tool versus the CLI, how to keep a `GET
file` call from burning a month's Tier 1 quota, and the setup steps that turn a `403` into
a fix.

## Installation

The skills, the MCP server, and the CLI ship together as a plugin inside the `cyber-figma`
npm package. Installing the plugin gets all three:

```sh
/plugin marketplace add cyberuni/cyber-figma
/plugin install cyber-figma@cyberuni
```

To take the skills on their own:

```sh
npx skills add cyberuni/cyber-figma
```

Or link individual skills into your agent's skills directory — `~/.claude/skills/`,
`~/.cursor/skills/`, and so on.

Set [authentication](/cyber-figma/authentication/) before running any workflow.

## Included skills

| Skill | Use when |
| --- | --- |
| [`init-figma`](https://github.com/cyberuni/cyber-figma/blob/main/packages/cyber-figma/skills/init-figma/SKILL.md) | First-time setup — personal access token, team ID, connection verify, MCP wiring. Also the skill to reach for when commands fail with auth, permission, or "team id required" errors |
| [`inspect-figma-file`](https://github.com/cyberuni/cyber-figma/blob/main/packages/cyber-figma/skills/inspect-figma-file/SKILL.md) | Reading a file's structure — pages, frames, components, styles, or one node — without wasting quota |
| [`export-figma-assets`](https://github.com/cyberuni/cyber-figma/blob/main/packages/cyber-figma/skills/export-figma-assets/SKILL.md) | Getting images out — nodes rendered to PNG, SVG, JPG, or PDF, or the original image fills |

The two file skills are deliberately split along the line the API draws: reading structure
and rendering images are different endpoints on different
[rate-limit tiers](/cyber-figma/reference/plans-and-limits/#which-endpoints-are-in-which-tier),
and conflating them is how an agent burns a Tier 1 budget.

## Why quota-awareness is a skill concern

Figma's rate limits punish the obvious approach. `GET file` is **Tier 1** — the most
expensive tier — and returns the entire document tree with no pagination, while `GET file
meta` is **Tier 3** and answers most "what is this file" questions. On a View or Collab
seat, Tier 1 is capped at roughly **6 calls per month** on every plan, Enterprise included.

So the skills encode the cheap path first: metadata before documents, `depth` and `ids`
before a full tree, and one batched `GET images` call listing many node IDs rather than one
call per image — which is the mitigation Figma itself prescribes.

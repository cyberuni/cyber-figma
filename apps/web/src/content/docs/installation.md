---
title: Installation
description: Install cyber-figma as a CLI, as a local MCP server, or as an agent plugin.
sidebar:
  order: 1
---

:::caution[Not yet published]
`cyber-figma` is under active development and the `cyber-figma` package has not been
published to npm yet. The commands on this page describe the intended install paths; they
will not resolve until the first release. Follow
[cyberuni/cyber-figma](https://github.com/cyberuni/cyber-figma) for the release.
:::

## Requirements

- **Node.js 22 or newer** — the package declares `"engines": { "node": ">=22" }`.
- **A Figma credential.** A personal access token is the default and works on every plan,
  including free ones. See [Authentication](/cyber-figma/authentication/).

## CLI

Install globally to get the `cyber-figma` command on your `PATH`:

```sh
npm install -g cyber-figma
```

Or run it without installing:

```sh
npx cyber-figma <resource> <action>
```

For a project-local install — which is what an agent host should use, so the version is
pinned in the repo:

```sh
npm install cyber-figma
```

## Agent plugin

The published npm package **is** the plugin root, so installing the plugin gets the skills,
the MCP server, and the CLI in one step — there is no clone to keep in sync.

```sh
/plugin marketplace add cyberuni/cyber-figma
/plugin install cyber-figma@cyberuni
```

The package ships an [Agent Plugins 1.0.0](https://github.com/agentplugins/agent-plugins-spec)
manifest (`plugin.json` / `mcp.json`) alongside per-vendor manifests for Claude Code
(`.claude-plugin/`), Cursor (`.cursor-plugin/`), and Codex (`.codex-plugin/`), so a
spec-conformant client and a vendor-specific one both find what they need.

:::note
The Agent Plugins spec expands only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`. The portable
`mcp.json` therefore sets no `env` block — a `"${FIGMA_ACCESS_TOKEN}"` value there would
reach the server as that literal string and shadow the real token. Under a spec-conformant
client, export the [authentication](/cyber-figma/authentication/) variables in the
environment that launches the agent.
:::

To take the skills on their own, without the CLI or the MCP server:

```sh
npx skills add cyberuni/cyber-figma
```

## MCP server

The MCP server ships in the same package and speaks stdio. Host-by-host configuration —
Claude Desktop, Claude Code, Cursor, Codex, and the MCP Inspector — is on the
[MCP reference](/cyber-figma/mcp/).

## Configuration

Two environment variables cover the common setup:

```sh
export FIGMA_ACCESS_TOKEN=<your-personal-access-token>
export FIGMA_TEAM_ID=<team-id>   # optional default team
```

`FIGMA_TEAM_ID` exists because Figma provides **no way to discover a team ID from a
token** — you read it out of the team page URL, from the segment after `/team/`. Both can
be overridden per invocation with `--token` and `--team`.

Read [Authentication](/cyber-figma/authentication/) before putting that `export` in a shell
profile — a Figma personal access token is a bearer credential with a 90-day life and no
rotation.

## From source

To work on `cyber-figma` itself:

```sh
git clone https://github.com/cyberuni/cyber-figma.git
cd cyber-figma
pnpm install
pnpm verify        # lint + build + typecheck + test + knip
pnpm dev <resource> <action>
```

See [CONTRIBUTING.md](https://github.com/cyberuni/cyber-figma/blob/main/CONTRIBUTING.md)
for the in-repo MCP server setup.

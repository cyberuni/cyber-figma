---
title: MCP server
description: Wiring the cyber-figma stdio MCP server into Claude, Cursor, Codex, and the MCP Inspector.
sidebar:
  order: 1
---

:::caution[Placeholder — no tools exist yet]
The per-tool reference is **not written**, because the tools have not been built. The
naming convention, the output contract, and the host wiring below are settled; the tool
catalog fills in as each resource domain lands.
[API coverage](/cyber-figma/reference/api-coverage/) is the live status board.
:::

`cyber-figma` ships a **stdio** MCP server in the same package as the CLI. Both call the
same core operations, so nothing is MCP-only or CLI-only.

Set your [authentication](/cyber-figma/authentication/) variables — `FIGMA_ACCESS_TOKEN`,
and optionally `FIGMA_TEAM_ID` — in the environment that launches the server.

## Server configuration

Install `cyber-figma` in the project that hosts your agent
([Installation](/cyber-figma/installation/)). The host spawns a child process and talks MCP
over stdio.

| Context | `command` | `args` |
| --- | --- | --- |
| Project dependency | `node` | `["-e", "import('cyber-figma/mcp')"]` |
| Project dependency (bin) | `cyber-figma` | `["mcp"]` |
| Ephemeral (`npx`) | `npx` | `["-y", "cyber-figma", "mcp"]` |

### Output format

Tools return JSON by default. Set `CYBER_FIGMA_MCP_FORMAT=toon` in the server's `env` to
emit token-efficient TOON instead. Formatting is applied centrally, so it is consistent
across every tool.

## Claude Desktop

| OS | Config file |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "cyber-figma": {
      "command": "node",
      "args": ["-e", "import('cyber-figma/mcp')"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "<your-token>",
        "FIGMA_TEAM_ID": "<team-id>"
      }
    }
  }
}
```

## Claude Code

**User or local scope** — recommended for a personal token:

```sh
claude mcp add -e FIGMA_ACCESS_TOKEN=<your-token> -e FIGMA_TEAM_ID=<team-id> cyber-figma -- \
  node -e "import('cyber-figma/mcp')"
```

**Project scope** — commit `.mcp.json` in the repo root:

```json
{
  "mcpServers": {
    "cyber-figma": {
      "command": "node",
      "args": ["-e", "import('cyber-figma/mcp')"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}",
        "FIGMA_TEAM_ID": "${FIGMA_TEAM_ID}"
      }
    }
  }
}
```

Verify with `claude mcp list`. Use `/mcp` in a session to reconnect without restarting.

:::note
Claude Code expands `${VAR}` in `.mcp.json`, but forwards the **literal text** when the
variable is unset. `cyber-figma` treats a value that is exactly an unexpanded reference as
absent, so a missing credential reports itself as missing rather than being sent to Figma
verbatim.
:::

## Cursor

User-wide: `~/.cursor/mcp.json`. Project-specific: `.cursor/mcp.json` in the repo root.
Agent mode is required for tool use. The JSON shape matches Claude Desktop's.

## Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.cyber-figma]
command = "node"
args = ["-e", "import('cyber-figma/mcp')"]

[mcp_servers.cyber-figma.env]
FIGMA_ACCESS_TOKEN = "<your-token>"
FIGMA_TEAM_ID = "<team-id>"
```

## MCP Inspector

Debug tools and schemas without an agent host:

```sh
npx @modelcontextprotocol/inspector \
  -e FIGMA_ACCESS_TOKEN=<your-token> \
  -- npx -y cyber-figma mcp
```

## Tool catalog

:::caution[Placeholder]
No tools are implemented yet. The table below records the naming convention and the planned
namespaces so the catalog can be filled in domain by domain.
:::

Tools are named `figma_<resource>_<action>` — for example `figma_file_get`,
`figma_comment_list`, `figma_webhook_create`.

| Namespace | Planned tools cover | Status |
| --- | --- | --- |
| `figma_file_*` | File JSON, node JSON, image rendering, image fills, metadata, versions | 📋 Planned |
| `figma_project_*` | Team projects, project metadata, project files | 📋 Planned |
| `figma_comment_*` | Comments and comment reactions | 📋 Planned |
| `figma_user_*` | The authenticated user | 📋 Planned |
| `figma_component_*` / `figma_component_set_*` / `figma_style_*` | Published library content | 📋 Planned |
| `figma_webhook_*` | Webhooks v2 | 📋 Planned |
| `figma_variable_*` | Variables (**Enterprise**) | 📋 Planned |
| `figma_dev_resource_*` | Dev Mode resource links | 📋 Planned |
| `figma_analytics_*` | Library Analytics (**Enterprise**) | 📋 Planned |
| `figma_activity_log_*` / `figma_developer_log_*` / `figma_ai_usage_*` / `figma_discovery_*` | Org-admin reporting (**Enterprise**) | 📋 Planned |
| `figma_payment_*` | Purchase validation | 📋 Planned |
| `figma_oembed_*` | oEmbed metadata | 📋 Planned |

List tools accept the shared pagination parameters wherever Figma supports paging. See
[API coverage](/cyber-figma/reference/api-coverage/#pagination) for why that needs
normalizing at all.

## This is not Figma's MCP server

Figma ships **its own** MCP server, which per Figma's scopes documentation *"handles its
own OAuth authentication flow — you don't configure REST API scopes for it"*, and whose
access is limited to clients listed in the Figma MCP Catalog (with a waitlist for new
clients).

`cyber-figma`'s MCP server is a different thing: a **local REST API wrapper** using REST API
credentials. It is not a client of Figma's MCP server, and the two can be installed
alongside each other — the config keys differ, and so do the tool names.

One thing worth knowing if your org audits API usage: Figma's
[Developer Logs](/cyber-figma/reference/api-coverage/#developer-logs) cover both REST API
and MCP server requests.

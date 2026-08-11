# Contributing

Guide for developing `cyber-figma` locally. AI coding assistants should also read [AGENTS.md](AGENTS.md).

## Setup

```sh
pnpm install
export FIGMA_ACCESS_TOKEN=<your-pat>   # required for system tests
export FIGMA_TEAM_ID=<team-id>         # optional default team
```

## Build and test

```sh
pnpm verify                        # lint + build + typecheck + test + knip
pnpm cf dev file get <file-key>    # run CLI without building (tsx)
pnpm cf test:system                # live API tests (requires FIGMA_SYSTEM_TEST=1)
```

`pnpm cf <script>` is the root shortcut for `pnpm run --filter=./packages/cyber-figma <script>`;
`dev`, `test:system` and `test:watch` live on the package, not the workspace root.

See [AGENTS.md](AGENTS.md) for the full command list, architecture, and conventions.

## Figma API reference

Do not work from memory of the Figma API. The researched surface is checked in:

- [`docs/research/figma-rest-api.md`](docs/research/figma-rest-api.md)
- [`docs/research/figma-plans-and-limits.md`](docs/research/figma-plans-and-limits.md)

Extend those files (with source links) when you need a fact they do not cover.

## MCP server

When working in this source tree, `import('cyber-figma/mcp')` does not resolve — there is no `node_modules/cyber-figma` self-link. Build first, then point MCP hosts at the built entry under `packages/cyber-figma/dist/`.

```sh
pnpm build
```

| Context | `command` | `args` |
| --- | --- | --- |
| MCP host (Cursor, Claude Desktop, etc.) | `node` | `["packages/cyber-figma/dist/cli.js", "mcp"]` or `["packages/cyber-figma/dist/mcp.js"]` |
| MCP Inspector | `node` | `["packages/cyber-figma/dist/cli.js", "mcp"]` — see [MCP Inspector](#mcp-inspector) |

### Cursor

In `~/.cursor/mcp.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cyber-figma": {
      "command": "node",
      "args": ["/absolute/path/to/cyber-figma/packages/cyber-figma/dist/mcp.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}",
        "FIGMA_TEAM_ID": "${FIGMA_TEAM_ID}"
      }
    }
  }
}
```

Reload MCP servers after changes.

### MCP Inspector

Debug tools and schemas without an agent host. UI defaults to [http://localhost:6274](http://localhost:6274).

```sh
pnpm build
npx @modelcontextprotocol/inspector \
  -e FIGMA_ACCESS_TOKEN="$FIGMA_ACCESS_TOKEN" \
  -e FIGMA_TEAM_ID="$FIGMA_TEAM_ID" \
  -- node packages/cyber-figma/dist/cli.js mcp
```

Consumer MCP setup (installed package) is documented in [readme.md](readme.md).

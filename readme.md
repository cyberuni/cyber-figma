# cyber-figma

A CLI, a local MCP server, and an agent plugin for the [Figma REST API](https://developers.figma.com/docs/rest-api/) — built for AI-assisted workflows.

📖 **[Documentation](https://cyberuni.github.io/cyber-figma/)**

- **CLI** — `cyber-figma <resource> <action>` for terminals, scripts, and agents that shell out. [Jump to CLI →](#cli)
- **MCP** — a local stdio server exposing `figma_*` tools. [Jump to MCP →](#mcp-server)
- **Plugin** — the published npm package *is* the plugin root. [Jump to plugin →](#agent-plugin)

> **Status: scaffolding.** The package is not published to npm yet and no commands or tools
> are implemented. What *is* finished is the researched Figma surface the implementation is
> built against — see [Research](#research) — and the documentation site covering
> authentication, plans, limits, and API coverage.

## Installation

```sh
npm install -g cyber-figma
```

Requires Node.js 22 or newer. See the
[installation guide](https://cyberuni.github.io/cyber-figma/installation/) for the plugin
and MCP paths.

## Authentication

```sh
export FIGMA_ACCESS_TOKEN=<your-personal-access-token>
export FIGMA_TEAM_ID=<team-id>   # optional default team
```

Or pass `--token <pat>` and `--team <id>` per command.

Create a token at **Settings → Security → Generate new token** in Figma, choosing scopes at
creation time. Figma has three auth modes and they are **not interchangeable** — each
reaches a different subset of the API:

| | Personal access token | Plan access token | OAuth 2 |
| --- | --- | --- | --- |
| Header | `X-Figma-Token` | `X-Figma-Token` | `Authorization: Bearer` |
| Plan required | none | Organization or Enterprise | none |
| Max expiration | 90 days, no rotation | 365 days, refreshable | 90 days, refreshable |
| Rate limit counted per | **user** — every script shares one budget | **token** | user, per app |

`cyber-figma` defaults to a personal access token because it is the only mode covering the
whole surface: plan tokens cannot write comments or variables and cannot call `/v1/me`, and
OAuth cannot call the Payments API at all.

`FIGMA_TEAM_ID` exists because Figma provides **no way to discover a team ID from a
token** — read it from the segment after `/team/` in the team page URL.

Two things that reliably surprise people:

- **An expired token answers `403`, not `401`.** Do not read `403` as "permission denied"
  alone.
- **A View or Collab seat gets ~6 `GET file` calls per month**, on every plan including
  Enterprise.

Full detail: [Authentication](https://cyberuni.github.io/cyber-figma/authentication/) ·
[Plans and limits](https://cyberuni.github.io/cyber-figma/reference/plans-and-limits/).

Keep the token out of `~/.zshrc` — put it in a `0600` file and source that, or read it from
a password manager. Shell profiles are world-readable and are the files most likely to end
up in a dotfiles repo.

## CLI

```sh
cyber-figma <resource> <action> [options]
```

Global options: `--token`, `--team`, `--json`, `--toon` (token-efficient
[TOON](https://github.com/kunchenguid/axi#the-10-principles) for agents), `--full`.

No commands are implemented yet. The planned namespace map and the output, pagination, and
error conventions are on the [CLI overview](https://cyberuni.github.io/cyber-figma/cli/).

## MCP server

A local **stdio** server, shipped in the same package and calling the same core operations
as the CLI. Tools are named `figma_<resource>_<action>`.

```json
{
  "mcpServers": {
    "cyber-figma": {
      "command": "node",
      "args": ["-e", "import('cyber-figma/mcp')"],
      "env": { "FIGMA_ACCESS_TOKEN": "<your-token>" }
    }
  }
}
```

Set `CYBER_FIGMA_MCP_FORMAT=toon` for token-efficient output. Per-host wiring for Claude
Desktop, Claude Code, Cursor, Codex, and the MCP Inspector is on the
[MCP page](https://cyberuni.github.io/cyber-figma/mcp/).

This is **not** Figma's own MCP server. Figma ships one that handles its own OAuth flow and
is limited to clients in the Figma MCP Catalog; this is a local REST API wrapper using REST
API credentials. The two can be installed side by side.

## Agent plugin

The published npm package **is** the plugin root, so installing the plugin gets the skills,
the MCP server, and the CLI at once — no clone to keep in sync.

```sh
/plugin marketplace add cyberuni/cyber-figma
/plugin install cyber-figma@cyberuni
```

The package ships an [Agent Plugins 1.0.0](https://github.com/agentplugins/agent-plugins-spec)
manifest (`plugin.json` / `mcp.json`) alongside per-vendor manifests for Claude Code,
Cursor, and Codex.

The spec expands only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`, so the portable `mcp.json`
sets no `env` block — a `"${FIGMA_ACCESS_TOKEN}"` value there would reach the server as
that literal string and shadow the real token. Export the variables in the environment that
launches the agent.

## API coverage

The Figma REST API is **53 HTTP operations**: 50 in the OpenAPI spec, plus a Discovery
endpoint absent from the spec, plus 2 OAuth token endpoints. Only **11 mutate** — comments,
reactions, webhooks, variables, and dev resources. Nothing in the REST API creates or
deletes files, projects, teams, pages, or nodes; that lives in the Plugin API.

Every endpoint group, its status here, its rate-limit tier, and its plan gate:
[API coverage](https://cyberuni.github.io/cyber-figma/reference/api-coverage/).

## Research

Figma API facts in this repo are researched, not remembered. Two documents are the source
of truth for every claim on the site and in the code:

| Document | Covers |
| --- | --- |
| [`docs/research/figma-rest-api.md`](docs/research/figma-rest-api.md) | Endpoint inventory, response shapes, the four pagination models, known OpenAPI spec defects, documented gaps |
| [`docs/research/figma-plans-and-limits.md`](docs/research/figma-plans-and-limits.md) | Plan and seat gating, the 24 OAuth scopes, rate limits, token lifecycle |

The full research record — question framing, evidence log with confidence ratings,
contradictions, and recheck triggers — lives under [`.research/`](.research/).

If a fact you need is missing, add it there with a source link rather than inlining it
elsewhere.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup and the in-repo MCP server
configuration, and [AGENTS.md](AGENTS.md) for the architecture and conventions AI coding
assistants should follow.

```sh
pnpm install
pnpm verify        # lint + build + typecheck + test + knip
pnpm web dev       # run the documentation site locally
```

## License

[MIT](license)

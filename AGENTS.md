# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Skill Augmentations

When reading any `SKILL.md` file, always check whether a `SKILL.local.md` exists in the same directory. If it does, treat its contents as additional instructions that extend the base skill. Local augmentations take precedence over the base skill where they conflict.

## Commit Discipline

**Auto-commit rule:** When a unit of work is complete and verified, commit it immediately — do not wait for the user to ask. Batching multiple units into one commit, or finishing all work before committing, are both violations of this rule.

**Unit of work:** one coherent, independently revertable change — one domain's refactor, one feature, one bugfix, one test suite expansion for one concern, one config change. Never two unrelated concerns in the same commit. A TDD red-green-refactor cycle alone is not a commit boundary; commit when the full intended change is complete and tests pass. If the working tree has unrelated changes, leave them unstaged — commit the current unit first, then continue.

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One concern per commit; never batch unrelated changes
- Stage only files for this unit: `git add <files>`, then verify with `git diff --cached`
- Never use `git add .`, `git add -A`, or `git add -p` (interactive commands agents cannot run)
- Never commit with red tests; run validation commands first

### References

- **`commit-work` skill** — staging, splitting, and message writing when committing
- `npx cyber-skills@<version> governance show skill-repo-structure` — discipline section format rules

## Development Workflow

Before writing any production code, invoke the `test-driven-development` skill. This applies whether coding starts from a user request or from your own initiative after plan approval.

## What This Repo Is

`cyber-figma` — an npm package that wraps the [Figma REST API](https://www.figma.com/developers/api) as:

- A CLI (`cyber-figma <resource> <action>`) powered by Commander
- A local MCP server powered by `@modelcontextprotocol/sdk` — see [CONTRIBUTING.md](CONTRIBUTING.md) for in-repo setup
- An agent plugin — the package root *is* the plugin root, so the tarball ships `plugin.json`, `mcp.json`, `skills/`, and the per-vendor manifests

### Figma API facts

Do not invent API facts from memory. The researched surface lives in the repo:

- [`docs/research/figma-rest-api.md`](docs/research/figma-rest-api.md) — endpoints, resources, response shapes, pagination model
- [`docs/research/figma-plans-and-limits.md`](docs/research/figma-plans-and-limits.md) — plan gating, scopes, and rate limits

If a fact you need is missing from those files, add it there (with a source link) rather than inlining it here.

### Plugin layout

Everything the plugin needs lives in `packages/cyber-figma/` and must stay listed in that package's `files`, or it will not reach consumers.

| Path | Read by |
| --- | --- |
| `plugin.json` / `mcp.json` | [Agent Plugins 1.0.0](https://github.com/agentplugins/agent-plugins-spec) clients. Manifest schema is **closed** — components come from fixed locations, never inline fields |
| `.claude-plugin/plugin.json` / `.mcp.json` | Claude Code |
| `.cursor-plugin/plugin.json` | Cursor |
| `.codex-plugin/plugin.json` | Codex |
| `.plugin/plugin.json` | Canonical universal-plugin source; not published |
| `skills/<name>/SKILL.md` | All of them (fixed location) |

`.claude-plugin/marketplace.json` at the **repo root** lists the plugin with an `npm` source. When the plugin manifests land, add `scripts/sync-plugin-version.mjs` (mirroring cyber-asana's) and wire it into the root `version` script so manifest versions follow `packages/cyber-figma/package.json`.

Only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` expand in `mcp.json`; never put a `"${SOME_VAR}"` value in its `env`, as it arrives literally and shadows the real variable.

Claude Code's `.mcp.json` does expand `${VAR}`, but forwards the literal text when the variable is unset. The env resolver in `src/env.ts` must guard for this: a value that is exactly an unexpanded reference counts as absent, so a missing credential reports itself as missing instead of being sent to Figma verbatim.

## Commands

```
pnpm test src/client.test.ts  # run one test file
pnpm test                     # unit + acceptance tests
pnpm test:system              # live API tests when env vars are set
pnpm verify                   # lint + build + typecheck + test + knip
pnpm build                    # compile to dist/
pnpm dev <resource> <action>  # run CLI from source
```

`pnpm cf <script>` at the repo root is the shortcut for `pnpm run --filter=./packages/cyber-figma <script>`.

## Architecture: Screaming Architecture

The codebase is organized by Figma resource domain (files, nodes, comments, components, styles, projects, teams, webhooks, …) rather than by technical layer. Each domain keeps its gateway, API facade, CLI bindings, and MCP registrations together so CLI commands and MCP tools share the same core operations instead of duplicating HTTP calls.

Shared wiring lives in `src/composition.ts`, while common concerns such as client creation, pagination, option normalization, and output formatting stay in top-level support modules. Tests mirror the architecture: unit tests sit beside modules, acceptance specs exercise gateway contracts against doubles, and system tests reuse those specs against the live API.

### Testing

- **Unit tests**: `*.test.ts` beside the module under test.
- **Acceptance specs**: `*.acceptance.ts` export `define*AcceptanceSpecs()` factories; `*.acceptance.test.ts` runs them against gateway doubles (no network).
- **System tests**: `*.system.ts` reuse the same acceptance factories against `createRuntimeContext()` and the live API. Gated by env vars; skipped when unset.

Run system tests:

```sh
FIGMA_SYSTEM_TEST=1 FIGMA_ACCESS_TOKEN=<pat> pnpm test:system
```

Which optional env vars gate which suite is decided as the suites are written; record each one in the table under **Environment** when you add it.

## Key Conventions

- **Authentication**: `FIGMA_ACCESS_TOKEN` env var (personal access token); override per-invocation with `--token <pat>`
- **Team**: `FIGMA_TEAM_ID` env var for the default team id; override with `--team <id>`
- **No duplication**: CLI and MCP both call `api.ts`; never inline HTTP or SDK calls in `cli.ts` or `mcp.ts`
- **Figma API client**: TODO — the transport choice (raw `fetch` vs a published client) and its response-unwrapping convention land with the first domain; document it here then, sourced from [`docs/research/figma-rest-api.md`](docs/research/figma-rest-api.md)

### Agent-friendly output

The CLI and MCP follow the [10 agent-CLI principles](https://github.com/kunchenguid/axi#the-10-principles). Keep new commands consistent:

- **Structured output** goes through `src/output.ts` (`output(data, readable)`); `--toon` (TOON, `src/toon.ts`) and `--json` are handled there — never branch on `process.argv` for format in a command.
- **Empty states**: use `printEmpty(entity)` / `printTable(items, cols, { entity })` so an empty result names what was empty (`0 files found`), never `(none)` or a blank line.
- **Truncation**: wrap large free-text fields with `truncate(value, { full: isFull() })` from `src/truncate.ts`. Figma document trees are deep — truncate node payloads by default.
- **Aggregates & next steps**: use `printCountSummary()` / `printSummary()` and `printNextSteps()` (text-mode only) from `src/output.ts`.
- **Minimal default schemas**: list and get commands request the smallest useful field/depth set when the user gives none.
- **Errors & exit codes**: the top-level CLI catch uses `renderCliError` / `exitCodeFor` from `src/cli-error.ts`; throw structured error objects, never call `process.exit` inside a command. Commander usage errors (unknown flag or subcommand) are handled by `src/cli-usage.ts` and exit `2`.
- **Mutations**: acknowledgements go through `output(payload, readable)` so `--json`/`--toon` are honored; deletes go through `deleteIdempotently()` from `src/idempotent-delete.ts`.
- **MCP**: tools serialize JSON; TOON is applied centrally by `withMcpOutputFormat` (env `CYBER_FIGMA_MCP_FORMAT=toon`). Do not re-implement formatting per tool.

### Pagination

Figma paginates inconsistently across resources (cursor, page-size, and unpaginated endpoints all exist) — see [`docs/research/figma-rest-api.md`](docs/research/figma-rest-api.md). Normalize it in `src/pagination.ts` so every list endpoint in `api.ts` takes one `PaginationOptions` shape and returns one `PaginatedResult` shape, whatever the endpoint underneath does. MCP list tools spread `paginationParams` from `src/mcp-options.ts`.

### MCP Tools

- Naming: `figma_<resource>_<action>` (e.g. `figma_file_get`)
- Schemas: use Zod (`z.string()`, `z.string().optional()`) for all parameters
- Return: `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`
- Registrations live in each domain's `mcp.ts`; wired via `registerMcpTools` in `src/composition.ts`
- List tools spread `paginationParams` from `src/mcp-options.ts` (see **Pagination** above)

Reference (load on demand, not duplicated here):

- Tool catalog by resource → `readme.md` MCP section
- Per-tool params and Zod schemas → `src/<domain>/mcp.ts` for the domain you are editing
- Figma URL parsing (file keys and node ids come out of `figma.com/design/...` URLs) → `src/url.ts` when a URL is present

## Environment

```
FIGMA_ACCESS_TOKEN=<personal access token>
FIGMA_TEAM_ID=<team id>   # optional; avoids --team on every command
```

System tests (see **Testing** above):

```
FIGMA_SYSTEM_TEST=1   # enable *.system.ts suites
FIGMA_TEAM_ID=...     # team-scoped list pagination
```

| Variable | Used by |
| --- | --- |
| `FIGMA_SYSTEM_TEST` | enables every `*.system.ts` suite |
| `FIGMA_TEAM_ID` | team-scoped list pagination system tests |

Add a row here for every new system-test env var.

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

`.claude-plugin/marketplace.json` at the **repo root** lists the plugin with an `npm` source. Version bumps flow from `packages/cyber-figma/package.json` through `scripts/sync-plugin-version.mjs` on `pnpm version` — add any new versioned manifest to that script's list. `mcp.json` and `.mcp.json` are not in it because they carry no `version` field.

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
- **Figma API client**: a hand-written `fetch` client in `src/client.ts`. There is no official Figma JS SDK, and the published OpenAPI spec has verified defects a generator would reproduce as bugs, so nothing is code-generated from it — `@figma/rest-api-spec` supplies **response types only**, re-exported through `src/figma-types.ts` with the documented corrections applied. Import response types from `src/figma-types.js`, never from `@figma/rest-api-spec` directly.
- **Response unwrapping**: some endpoints wrap their payload in `{ status, error, meta }` and others return it at the top level. A request declares `unwrap: 'meta'` when its endpoint wraps; the client returns the payload either way and throws when an envelope reports failure behind a 200.
- **Query parameters**: the client coerces every numeric query parameter to an integer, because the spec types 15 integer params as `number` and Figma rejects `30.0`. The one legitimately fractional parameter (`scale` on image renders) opts out with `floatParam()`.
- **Auth modes**: `--auth-mode` / `FIGMA_AUTH_MODE` selects `personal` (default), `plan`, or `oauth`. The first two send `X-Figma-Token`, OAuth sends a bearer token. The mode is configured, never sniffed from the token string.
- **Errors**: never interpret a status code in a domain. `src/figma-error.ts` classifies it — including the traps that make Figma's codes misleading (an expired token is a 403, not a 401; the Enterprise-gated endpoint groups refuse with an ordinary 401/403; a multi-day 429 with `X-Figma-Rate-Limit-Type: low` is usually a file in a personal Starter context). Attach a `hint` to a thrown error when an operation knows more than the status code does; it wins over the derived hint.
- **Adding a resource domain**: [`packages/cyber-figma/src/README-for-domain-pods.md`](packages/cyber-figma/src/README-for-domain-pods.md) is the contract, with a worked skeleton. A domain is one `defineDomain` entry in `DOMAINS` plus its own directory.

### Agent-friendly output

The CLI and MCP follow the [10 agent-CLI principles](https://github.com/kunchenguid/axi#the-10-principles). Keep new commands consistent:

- **Structured output** goes through `src/output.ts` (`output(data, readable)`); `--toon` (TOON, `src/toon.ts`) and `--json` are handled there — never branch on `process.argv` for format in a command.
- **Empty states**: use `printEmpty(entity)` / `printTable(items, cols, { entity })` so an empty result names what was empty (`0 files found`), never `(none)` or a blank line.
- **Truncation**: wrap large free-text fields with `truncate(value, { full: isFull() })` from `src/truncate.ts`. Figma document trees are deep — truncate node payloads by default.
- **Aggregates & next steps**: use `printCountSummary()` / `printSummary()` and `printNextSteps()` (text-mode only) from `src/output.ts`.
- **Minimal default schemas**: list and get commands request the smallest useful field/depth set when the user gives none.
- **Errors & exit codes**: the top-level CLI catch uses `renderCliError` / `exitCodeFor` from `src/cli-error.ts`; throw structured error objects, never call `process.exit` inside a command. Commander usage errors (unknown flag or subcommand) are handled by `src/cli-usage.ts` and exit `2`. The full map, which is part of the contract agents branch on: `0` ok, `1` error, `2` usage, `3` auth/config, `4` forbidden, `5` not found, `6` rate limited, `7` above the plan level.
- **Mutations**: acknowledgements go through `output(payload, readable)` so `--json`/`--toon` are honored; deletes go through `deleteIdempotently()` from `src/idempotent-delete.ts`.
- **MCP**: tools serialize JSON; TOON is applied centrally by `withMcpOutputFormat` (env `CYBER_FIGMA_MCP_FORMAT=toon`). Do not re-implement formatting per tool.

### Pagination

Figma has no single pagination model — see [`docs/research/figma-rest-api.md`](docs/research/figma-rest-api.md). `src/pagination.ts` names every real variant and normalizes the ends: one `PaginationOptions` in, one `PaginatedResult` out, whatever the endpoint underneath does.

| `PaginationSpec.model` | Endpoints | Request | Response |
| --- | --- | --- | --- |
| `url_cursor` | comment reactions, `/v2/webhooks` with `plan_api_id` | `cursor` | `pagination.{prev,next}_page` URLs |
| `url_page` | file versions | `page_size`, `before`/`after` | `pagination.{prev,next}_page` URLs |
| `id_cursor` | team components, component sets, styles | `page_size`, `before`/`after` | `meta.cursor.{before,after}` integers |
| `row_cursor` | all six Library Analytics endpoints | `cursor` | `{ rows, next_page: boolean, cursor? }` |
| `next_cursor` | AI Usage | `cursor`, `limit` | `{ rows, next_cursor, has_next_page }` |
| `meta_cursor` | Developer Logs (in the **body**) | `cursor`, `limit` | `meta: { items, cursor, has_more }` |
| `none` | the majority — file, nodes, images, comments, project files, variables, dev resources, … | — | everything at once |

Each list endpoint declares its spec once; `paginationParamsFor` builds the request params, `collectPages` walks with that model's own advance parameter, and `addPaginationOptions` / `paginationParams` derive the CLI flags and MCP tool params from it — so a command cannot advertise a `--cursor` its endpoint does not have.

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
FIGMA_DEV_RESOURCE_FILE_KEY=...  # dev resources: a MAIN file key, never a branch
FIGMA_DEV_RESOURCE_NODE_ID=...   # dev resources: also run the write round-trip on this node
```

| Variable | Used by |
| --- | --- |
| `FIGMA_ACCESS_TOKEN` | every command; alias `FIGMA_TOKEN`. Override with `--token` |
| `FIGMA_TEAM_ID` | team-scoped commands; alias `FIGMA_TEAM`. Override with `--team`. Accepts a team URL |
| `FIGMA_AUTH_MODE` | `personal` (default), `plan`, or `oauth`. Override with `--auth-mode` |
| `FIGMA_API_BASE_URL` | base URL override, for Figma for Government (`https://api.figma-gov.com`) |
| `CYBER_FIGMA_MCP_FORMAT` | `toon` switches MCP tool output to TOON |
| `FIGMA_SYSTEM_TEST` | enables every `*.system.ts` suite |
| `FIGMA_ACTIVITY_LOGS_SYSTEM_TEST` | `src/activity-logs/*.system.ts` — opt-in. Needs an Enterprise org admin credential in `plan` or `oauth` mode; a PAT cannot reach the endpoint |
| `FIGMA_DEVELOPER_LOGS_SYSTEM_TEST` | `src/developer-logs/*.system.ts` — opt-in. Needs Enterprise + Governance+, an org admin, and `FIGMA_AUTH_MODE=plan`; no other credential reaches it |
| `FIGMA_AI_USAGE_SYSTEM_TEST` | `src/ai-usage/*.system.ts` — opt-in. Needs Enterprise, an org admin, and `FIGMA_AUTH_MODE=plan` |
| `FIGMA_AI_USAGE_START_DATE` / `FIGMA_AI_USAGE_END_DATE` | optional window for the AI usage suite (`YYYY-MM-DD`, no earlier than 2025-12-01) |
| `FIGMA_DISCOVERY_SYSTEM_TEST` | `src/discovery/*.system.ts` — opt-in. Needs Enterprise + Governance+, an org admin, and `FIGMA_AUTH_MODE=oauth`; only OAuth 2 reaches it |
| `FIGMA_DISCOVERY_START_DATE` / `FIGMA_DISCOVERY_END_DATE` | optional window for the discovery suite (ISO 8601 UTC; defaults to a two-hour window a day back) |
| `FIGMA_ANALYTICS_LIBRARY_FILE_KEY` | `src/analytics/*.system.ts` — the key of a published library file. Enterprise plan required |
| `FIGMA_DEV_RESOURCE_FILE_KEY` | `src/dev-resources/*.system.ts` — a **main** file key, never a branch key |
| `FIGMA_DEV_RESOURCE_NODE_ID` | `src/dev-resources/*.system.ts` — optional; a node in that file, which adds the create/update/delete round-trip |
| `FIGMA_FILE_KEY` | `src/files/*.system.ts` — a file the credential can read. The suite spends tier-1 calls, so it also needs `FIGMA_NODE_ID` before it runs |
| `FIGMA_NODE_ID` | `src/files/*.system.ts` — a node id in that file, dashed URL form accepted |
| `FIGMA_OEMBED_URL` | `src/oembed/*.system.ts` — a Figma file or published Make URL the credential can see. Not reachable with a plan access token |
| `FIGMA_WEBHOOK_SYSTEM_ENDPOINT` | opts the webhook lifecycle system spec in: an HTTPS URL a throwaway **PAUSED** webhook may point at on `FIGMA_TEAM_ID`. Nothing is ever delivered to it, and the webhook is deleted in a `finally` |
| `FIGMA_WEBHOOK_SYSTEM_PLAN_API_ID` | opts the live webhook list-pagination spec in: a plan api id (`team-<teamId>` or `organization-<orgId>`), the only form of `GET /v2/webhooks` that paginates |
| `FIGMA_LIBRARY_FILE_KEY` | `src/library/*.system.ts` — a **main** file key whose components, component sets, and styles are published. Branch keys cannot publish |
| `FIGMA_LIBRARY_MULTIPAGE` | `src/library/*.system.ts` — `1` when the team library exceeds one page of 30, enabling the multi-page specs |

Add a row here for every new system-test env var.

A repo can also commit its team id so contributors need no environment at all —
`.agents/cyber-figma.json`, read by `src/repo-config.ts`:

```json
{ "schema_version": 1, "team_id": "1234567890" }
```

Precedence for the team id, highest first: a command argument, `--team`,
`FIGMA_TEAM_ID`, then this file. The environment wins over the checked-in file
so a contributor can retarget one shell without editing a tracked file.

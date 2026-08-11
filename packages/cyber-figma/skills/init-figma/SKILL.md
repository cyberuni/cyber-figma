---
name: init-figma
description: Use this skill when setting up cyber-figma — personal access token, team id, connection verify, and MCP wiring.
---

# Init Figma

## When to use

When the user is setting up `cyber-figma` for the first time, or when commands fail with auth, permission, or "team id required" errors.

## Ensure cyber-figma CLI

Before running any `cyber-figma` command:

1. **Resolve pinned version** — latest published semver: `npm view cyber-figma version`. Use this value as `<exact>` for every `npx cyber-figma@<exact>` in this skill and all other cyber-figma skills (never `@latest`, never a literal placeholder).
2. **Check availability**: `npx cyber-figma@<exact> --version` (or `cyber-figma --version` if globally installed).
3. If that succeeds, proceed normally.

If it fails (npx install prompt, `command not found`, or other non-zero exit):

1. Tell the user the workflow needs to download `cyber-figma` from npm (no `package.json` change).
2. **Ask** whether to install.
3. After yes, run the one-time install only: `npx --yes cyber-figma@<exact> --version`
4. For all later commands, use `npx cyber-figma@<exact> <subcommand>` (no `--yes`) or `cyber-figma` if globally installed.
5. If the user declines npx, ask whether to add `cyber-figma` as a devDependency instead. Note drawbacks: it modifies `package.json` and may need ignoring in unused-dependency tools (e.g. `knip`). If they decline both, skip CLI steps.

## Global flags and exit codes

Every command inherits these:

| Flag | Effect |
| --- | --- |
| `--token <pat>` | override `FIGMA_ACCESS_TOKEN` for this invocation |
| `--team <id>` | override `FIGMA_TEAM_ID` for this invocation |
| `--toon` | TOON output — token-efficient, prefer it for agents |
| `--json` | raw JSON |
| `--full` | do not truncate large text fields |

Exit codes are stable; branch on them rather than on message text:

| Code | Meaning |
| --- | --- |
| `0` | ok |
| `1` | generic failure |
| `2` | usage error (unknown flag or subcommand) |
| `3` | auth / config problem — token missing or invalid |
| `4` | forbidden — no access, or an expired token |
| `5` | not found |
| `6` | rate limited (`429`) |
| `7` | plan-gated — the endpoint needs Enterprise (see step 6) |

For the exact resource commands and their flags, run `cyber-figma --help` and `cyber-figma <resource> --help`.

## Instructions

### 1. Check for existing credentials

```bash
echo "Token set: ${FIGMA_ACCESS_TOKEN:+yes}${FIGMA_TOKEN:+ (via FIGMA_TOKEN alias)}"
echo "Team set: ${FIGMA_TEAM_ID:+yes}${FIGMA_TEAM:+ (via FIGMA_TEAM alias)}"
```

`FIGMA_TOKEN` and `FIGMA_TEAM` work as aliases, but new setup should use the canonical names. A value that is literally an unexpanded `${VAR}` counts as **absent** — that is what a host config forwards when the variable is not exported, and it is reported as a missing credential rather than sent to Figma.

### 2. Set FIGMA_ACCESS_TOKEN

If not set, guide the user:

1. Go to Figma → Settings → Security → **Generate new token**
2. Choose an expiration and select scopes at creation time (see **Scopes to pick** below)
3. Copy the token — **Figma shows it only once**
4. Add to the user's shell profile: `export FIGMA_ACCESS_TOKEN=...` in the file their shell loads on login

Or pass per-command with `--token <pat>`.

Two facts to tell the user up front, because both look like bugs later:

- **A personal access token expires after at most 90 days**, and there is no automatic rotation. The old "no expiration" option was removed. Plan on rotating.
- **Figma reports an expired token as `403`, not `401`.** If commands that used to work start failing with a permission error, suspect expiry first.

#### Scopes to pick

A token never exceeds the user's own Figma permissions, so request the narrowest set that covers the intended work. Prefer the granular scopes over the deprecated, extremely permissive `files:read`.

| Work the user wants | Scopes |
| --- | --- |
| Verify the connection | `current_user:read` |
| Inspect files and nodes | `file_content:read`, `file_metadata:read` |
| Browse teams and projects | `projects:read`, `project_metadata:read` |
| Export rendered assets | `file_content:read` |
| Read comments | `file_comments:read` |
| Post or delete comments | `file_comments:write` |
| Published components and styles | `team_library_content:read` (team), `library_content:read` (file) |
| Version history | `file_versions:read` |

### 3. Verify the connection

Ensure the CLI is available first (see **Ensure cyber-figma CLI**), then run:

```bash
cyber-figma user me --toon
# or, if using npx without global install:
npx cyber-figma@<exact> user me --toon
```

This calls `GET /v1/me` and prints the authenticated user. (`--toon` is the token-efficient format; use `--json` for raw JSON.)

If it fails, the token is invalid, expired, or missing the `current_user:read` scope.

> **Plan access tokens cannot call `/v1/me` at all.** If the user is setting up a plan access token (Organization/Enterprise only, minted by an org admin at <https://www.figma.com/developers/tokens>), verify with a file-metadata read against a known file instead — see step 5.

### 4. Set FIGMA_TEAM_ID

**Figma provides no way to discover a team id from a token** — the user must read it from a URL. Ask them to open the team in Figma and copy the segment after `/team/`:

```
https://www.figma.com/files/team/1234567890123456789/Some-Team
                                 ^^^^^^^^^^^^^^^^^^^ this
```

Add it to their shell profile:

```bash
export FIGMA_TEAM_ID=<team-id>
```

This avoids passing `--team` on every team-scoped command. Verify:

```bash
cyber-figma project list --toon
```

That lists the projects visible to the token holder in that team.

### 5. Confirm setup

```bash
cyber-figma file meta <file-key>
```

The file key is the segment after `/design/` (or the older `/file/`) in any Figma file URL. A successful metadata read confirms token, scopes, and file access together — and it is the cheapest call in the API (rate-limit tier 3), so it is the safe thing to retry with.

### 6. Know the limits before the user hits them

Three gates cause almost all confusing failures. Explain whichever applies:

- **Seat type, not plan, sets the rate limit.** A View or Collab seat gets roughly **6 `GET file` / `GET file nodes` / `GET image` calls per month** — on *every* plan, including Enterprise. If the user's core flow is "read a file", a Dev or Full seat is required for it to be usable at all.
- **The limit follows the plan the file lives in**, not the best plan the user belongs to. A file sitting in the user's personal (Starter) space gets Starter treatment even for an Enterprise Full-seat user. If a `429` looks wildly out of proportion, check where the file actually lives.
- **Six endpoint families are Enterprise-only**: Variables (read *and* write), Library Analytics, Activity Logs, Developer Logs, AI Usage, and Discovery. Activity Logs, Developer Logs, AI Usage, and Discovery additionally require an **org admin**, and Developer Logs and Discovery additionally require the **Governance+** add-on. None of these work with an ordinary PAT on a Starter, Professional, or Organization plan, and Activity Logs, Developer Logs, AI Usage, and Discovery are not reachable with a PAT at all.

On a `429`, read the response headers rather than guessing: `Retry-After` (seconds), `X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type` (`low` = View/Collab seat, `high` = Dev/Full), and `X-Figma-Upgrade-Link`.

### 7. Recommended — connect the MCP server (ambient session integration)

For AI agents, prefer connecting the cyber-figma MCP server as an ambient, always-available session integration first — then reach for the on-demand skills as needed. Add the cyber-figma MCP server to your host (see [readme — MCP Server](https://github.com/cyberuni/cyber-figma/blob/main/readme.md)) and set `CYBER_FIGMA_MCP_FORMAT=toon` in its `env` for token-efficient output.

The plugin ships host configs already, so in most hosts installing the plugin is enough. Those configs pass `FIGMA_ACCESS_TOKEN` and `FIGMA_TEAM_ID` through from the environment — the variables still have to be exported in step 2 and step 4.

### 8. Note — the official Figma MCP server is a different thing

Figma ships its own MCP server, which runs its own OAuth flow and is limited to clients in the Figma MCP Catalog. `cyber-figma` is not a client of it: it is a REST API wrapper using REST API credentials. The two can coexist under separate config keys.

## References

- [Figma — personal access tokens](https://developers.figma.com/docs/rest-api/personal-access-tokens/)
- [Figma — scopes](https://developers.figma.com/docs/rest-api/scopes/)
- [Figma — rate limits](https://developers.figma.com/docs/rest-api/rate-limits/)

# Adding a Figma resource domain

This directory is the shared spine: transport, errors, pagination, output, and
the CLI/MCP entrypoints. It implements **zero** Figma resource domains. This
file is the contract a domain implements so it drops in without touching
anything else.

Read [`docs/research/figma-rest-api.md`](../../../docs/research/figma-rest-api.md)
for the endpoint you are wrapping before you start — especially **Known spec
defects** and **Pagination models**. Do not invent API facts; if one is missing
from the research docs, add it there with a source link.

---

## What the spine already handles

Do not re-implement any of this in a domain.

| Concern | Where | What you get |
| --- | --- | --- |
| HTTP, auth, retries | `client.ts` | `X-Figma-Token` vs bearer by auth mode, integer coercion on query params, `{status, error, meta}` unwrapping, the `err` diagnostic, bounded 429 retry |
| Errors | `figma-error.ts` | `FigmaApiError` → named reason + actionable hint. Never catch a status code in a domain to write your own message |
| Exit codes / rendering | `cli-error.ts`, `mcp-error.ts` | Installed once at the top level. Throw; do not call `process.exit` |
| Pagination | `pagination.ts` | Six real models + `none`, one options shape in, one result shape out |
| CLI flags / MCP params | `cli-options.ts`, `mcp-options.ts` | Derived from your pagination spec, so you cannot advertise a flag your endpoint lacks |
| Output | `output.ts`, `toon.ts`, `truncate.ts` | `--json` / `--toon` / text, empty states, summaries, next steps, `--full` |
| Identifiers | `url.ts`, `scope.ts` | File keys and node ids out of URLs; team id from `--team` / `FIGMA_TEAM_ID` |
| Deletes | `idempotent-delete.ts` | A repeat delete succeeds with `already_absent` |
| Test doubles | `testing/` | A client double per pagination model, and the list contract as a reusable spec factory |

Global flags already on the root program, inherited by every command:
`--token`, `--team`, `--auth-mode`, `--json`, `--toon`, `--full`, `--version`,
`--help`.

Exit codes, stable and part of the contract: `0` ok, `1` error, `2` usage,
`3` auth/config, `4` forbidden, `5` not found, `6` rate limited, `7` above the
plan level.

---

## Layout

One directory per Figma resource domain, holding every layer of that domain
together (Screaming Architecture):

```
src/comments/
  gateway.ts                   HTTP only: FigmaClient in, typed response out
  gateway.acceptance.ts        the contract the gateway owes, as a spec factory
  gateway.acceptance.test.ts   runs that factory against doubles (no network)
  gateway.system.ts            runs the same factory against the live API
  api.ts                       the operations the CLI and MCP both call
  api.test.ts
  cli.ts                       Commander bindings
  mcp.ts                       MCP tool registrations
  index.ts                     the DomainModule that ties the three together
```

Then two one-line edits outside your directory:

- `composition.ts` → add your module to `DOMAINS`
- `index.ts` → `export * from './comments/api.js'` and `'./comments/gateway.js'`

Nothing else in the spine changes.

---

## Worked skeleton

Using comments, because it exercises a read, a write, a delete, and the
`none` pagination model.

### `gateway.ts` — HTTP only

The gateway knows paths and parameters. It knows nothing about output format,
CLI flags, or MCP. Response types come from `figma-types.js`, never from
`@figma/rest-api-spec` directly — the local module carries the corrections for
the spec's known defects.

```ts
import type { FigmaClient } from '../client.js'
import type { Comment, GetCommentsResponse } from '../figma-types.js'
import type { PaginationSpec } from '../pagination.js'

/** GET file comments returns the whole list at once. */
export const COMMENT_LIST_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'comments' }

export type CommentGateway = {
  list: (fileKey: string, opts?: { asMarkdown?: boolean }) => Promise<GetCommentsResponse>
  create: (fileKey: string, body: { message: string; comment_id?: string }) => Promise<Comment>
  remove: (fileKey: string, commentId: string) => Promise<void>
}

export function createFigmaCommentGateway(client: FigmaClient): CommentGateway {
  return {
    list: (fileKey, opts) =>
      client.request({
        method: 'GET',
        path: `/v1/files/${encodeURIComponent(fileKey)}/comments`,
        query: { as_md: opts?.asMarkdown },
      }),
    create: (fileKey, body) =>
      client.request({ method: 'POST', path: `/v1/files/${encodeURIComponent(fileKey)}/comments`, body }),
    remove: (fileKey, commentId) =>
      client.request({
        method: 'DELETE',
        path: `/v1/files/${encodeURIComponent(fileKey)}/comments/${encodeURIComponent(commentId)}`,
      }),
  }
}
```

For an endpoint that **does** paginate, declare its real model and let
`collectPages` walk it:

```ts
// GET team components: page_size (default 30, max 1000) with opaque integer cursors.
export const COMPONENT_LIST_PAGINATION: PaginationSpec = {
  model: 'id_cursor',
  itemsKey: 'components',
  defaultPageSize: 30,
  maxPageSize: 1000,
}

list: (teamId: string, opts?: PaginationOptions) =>
  collectPages<PublishedComponent>(COMPONENT_LIST_PAGINATION, (page) =>
    client.request({
      method: 'GET',
      path: `/v1/teams/${encodeURIComponent(teamId)}/components`,
      query: paginationParamsFor(COMPONENT_LIST_PAGINATION, { ...page, applyDefaults: true }),
    }),
    opts,
  )
```

### `api.ts` — the shared operations

The CLI and MCP call exactly these. No HTTP here, and no HTTP in `cli.ts` or
`mcp.ts` — that duplication is what this layer exists to prevent.

```ts
import { deleteIdempotently, type DeleteResult } from '../idempotent-delete.js'
import { fileKeyFromInput } from '../url.js'
import type { CommentGateway } from './gateway.js'

export type CommentApi = {
  list: (file: string, opts?: { asMarkdown?: boolean }) => Promise<Comment[]>
  create: (file: string, message: string, replyTo?: string) => Promise<Comment>
  remove: (file: string, commentId: string) => Promise<DeleteResult>
}

export function createCommentApi(gateway: CommentGateway): CommentApi {
  return {
    // Every file-key parameter goes through fileKeyFromInput, so a pasted URL
    // works everywhere a bare key does.
    list: async (file, opts) => (await gateway.list(fileKeyFromInput(file), opts)).comments,
    create: (file, message, replyTo) =>
      gateway.create(fileKeyFromInput(file), { message, ...(replyTo && { comment_id: replyTo }) }),
    remove: (file, commentId) =>
      deleteIdempotently('comment', commentId, () => gateway.remove(fileKeyFromInput(file), commentId)),
  }
}
```

### `cli.ts` — Commander bindings

```ts
import { Command } from 'commander'
import { addPaginationOptions } from '../cli-options.js'
import { deleteMessage } from '../idempotent-delete.js'
import { output, printCountSummary, printNextSteps, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import type { CommentApi } from './api.js'
import { COMMENT_LIST_PAGINATION } from './gateway.js'

export function commentCommand(getApi: () => CommentApi): Command {
  const cmd = new Command('comment').description('Comments on a Figma file')

  addPaginationOptions(
    cmd
      .command('list')
      .argument('<file>', 'File key or Figma file URL')
      .option('--as-md', 'Return comment bodies as markdown')
      .action(async (file: string, opts: { asMd?: boolean }) => {
        const comments = await getApi().list(file, { asMarkdown: opts.asMd })
        output(comments, () => {
          printTable(
            comments,
            [
              { label: 'id', get: (c) => c.id },
              { label: 'author', get: (c) => c.user.handle },
              { label: 'message', get: (c) => truncate(c.message, { full: isFull() }) },
            ],
            { entity: 'comments' },
          )
          printCountSummary(comments.length, 'comment(s)')
          printNextSteps([`cyber-figma comment create ${file} --message "<text>"`])
        })
      }),
    COMMENT_LIST_PAGINATION, // no-op for `none`; adds the right flags for any other model
  )

  return cmd
}
```

Rules the spine enforces or expects:

- Structured output **only** through `output(data, readable)`. Never branch on
  `process.argv` for format.
- Empty states through `printEmpty` / `printTable(..., { entity })`, so an empty
  result says `0 comments found` rather than printing nothing.
- Truncate large free text with `truncate(value, { full: isFull() })`. Figma
  document trees are deep — truncate node payloads by default and keep default
  `depth`/`ids` minimal.
- Throw on failure. The top-level handler renders and picks the exit code.
  Never call `process.exit` in a command.
- For a mutation, acknowledge through `output(payload, readable)` so `--json`
  and `--toon` are honored.

### `mcp.ts` — tool registrations

```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import type { CommentApi } from './api.js'
import { COMMENT_LIST_PAGINATION } from './gateway.js'

export function registerCommentTools(server: McpServer, getApi: () => CommentApi) {
  server.tool(
    'figma_comment_list',
    'List the comments on a Figma file',
    {
      file: z.string().describe('File key or Figma file URL'),
      as_md: z.boolean().optional().describe('Return comment bodies as markdown'),
      ...paginationParams(COMMENT_LIST_PAGINATION),
    },
    async ({ file, as_md, ...page }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await getApi().list(file, { asMarkdown: as_md, ...paginationOptions(page) })),
        },
      ],
    }),
  )
}
```

- Tool names are `figma_<resource>_<action>`.
- Return `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`. TOON is
  applied centrally by `withMcpOutputFormat`; do not format per tool.
- Do not wrap tool bodies in try/catch — `withMcpErrorHandling` already does.

### `index.ts` — the module

```ts
import { defineDomain } from '../composition.js'
import { createCommentApi } from './api.js'
import { commentCommand } from './cli.js'
import { createFigmaCommentGateway } from './gateway.js'
import { registerCommentTools } from './mcp.js'

export const commentDomain = defineDomain({
  name: 'comment',
  createApi: (client) => createCommentApi(createFigmaCommentGateway(client)),
  command: commentCommand,
  registerTools: registerCommentTools,
})
```

And in `composition.ts`:

```ts
export const DOMAINS: AnyDomain[] = [
  commentDomain,
]
```

---

## Tests

TDD is required: one test, one implementation, repeat. Three layers, mirroring
the architecture.

**Unit** — `*.test.ts` beside the module. Use `createRecordingClient` to assert
what a gateway actually put on the wire:

```ts
import { createRecordingClient } from '../testing/paginating-gateway.js'

it('asks Figma for the comments of the file in the URL', async () => {
  const client = createRecordingClient([{ comments: [] }])
  await createFigmaCommentGateway(client).list('abc123')

  expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/files/abc123/comments' })
})
```

**Acceptance** — `*.acceptance.ts` exports a `define*AcceptanceSpecs()` factory;
`*.acceptance.test.ts` runs it against doubles. Any list operation must also run
the shared list contract:

```ts
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { createPaginatingClient } from '../testing/paginating-gateway.js'

describe(
  'component list',
  defineListPaginationAcceptanceSpecs({
    model: 'id_cursor',
    list: (opts) =>
      createComponentApi(
        createFigmaComponentGateway(createPaginatingClient(COMPONENT_LIST_PAGINATION, [['a'], ['b'], ['c']])),
      ).list('team-1', opts),
  }),
)
```

**System** — `*.system.ts` reuses the same factories against
`createRuntimeContext()` and the live API. Gate every suite:

```ts
import { isSystemTestEnabled, requireSystemEnv } from '../testing/system.js'

describe.skipIf(!isSystemTestEnabled())('comment gateway (live)', () => { /* … */ })
```

Add a row to the **Environment** table in `AGENTS.md` for every new env var a
system suite needs.

Run them:

```sh
pnpm cf test src/comments/comments.test.ts   # one file
pnpm cf test                                 # unit + acceptance
pnpm verify                                  # lint + build + typecheck + test + knip
FIGMA_SYSTEM_TEST=1 FIGMA_ACCESS_TOKEN=<pat> pnpm cf test:system
```

`pnpm verify` must exit 0 before every commit.

---

## Figma-specific traps

These bite per-domain and the spine cannot fix them for you.

- **Branch keys.** Most file-scoped endpoints take a file key *or* a branch key.
  `GET file components`, `component_sets`, `styles`, `variables/published`, and
  every Dev Resources endpoint require a **main** file key, because branches
  cannot publish. Say so in the flag description.
- **Published only.** The component, component-set, and style endpoints return
  only *published* library content, not everything in the file.
- **Partial success.** `POST`/`PUT /v1/dev_resources` can answer `200` with an
  `errors` array. A 2xx is not proof of success — inspect it and report it.
- **Nulls that are not errors.** In `GET /v1/images`, a `null` value means that
  *node* failed to render. Every requested id is present as a key regardless.
  Do not retry a `null` as a failure.
- **Expiring URLs.** Rendered image URLs last 30 days; image-fill URLs last no
  more than 14. Do not cache them as stable.
- **Tier 1 is expensive.** `GET file`, `GET file nodes`, and `GET images` are the
  costliest tier, and a View/Collab seat gets roughly **6 per month** on every
  plan. Prefer `GET file meta` (tier 3) for listing and inspection flows, and
  default `depth`/`ids` to the smallest useful set.
- **Batch renders.** One `GET images` call with many node ids, never one call per
  node — Figma names this as the primary way to avoid rate limits.
- **Enterprise gates.** Variables (read *and* write), Library Analytics, Activity
  Logs, Developer Logs, AI Usage, and Discovery are Enterprise-only. The spine
  already turns their 401/403 into exit code 7 with the requirement named, from
  the request path — so use the real paths and you get this for free.
- **Auth modes.** Plan access tokens cannot reach `/v1/me`, `/v1/oembed`, comment
  writes, or variable writes. Activity Logs and Discovery need OAuth or a plan
  token and will never work with a PAT.

# Coverage log

What each domain pod shipped, endpoint by endpoint. One section per domain,
alphabetical. Sections are additive — resolve a conflict here by keeping every
side's section.

## comments

**Endpoints covered — all 6 (Comments 3, Comment Reactions 3):**

| Endpoint | Command | MCP tool |
| --- | --- | --- |
| `GET /v1/files/{key}/comments` | `comment list <file>` | `figma_comment_list` |
| `POST /v1/files/{key}/comments` | `comment create <file>` | `figma_comment_create` |
| `DELETE /v1/files/{key}/comments/{id}` | `comment delete <file> <comment-id>` | `figma_comment_delete` |
| `GET …/comments/{id}/reactions` | `comment reaction list <file> <comment-id>` | `figma_comment_reaction_list` |
| `POST …/comments/{id}/reactions` | `comment reaction add <file> <comment-id> --emoji` | `figma_comment_reaction_add` |
| `DELETE …/comments/{id}/reactions` | `comment reaction delete <file> <comment-id> --emoji` | `figma_comment_reaction_delete` |

Nothing in the two endpoint groups was skipped.

**Deliberately not built:**

- **`comment get <id>`** — Figma has no get-one-comment endpoint. Faking it
  would cost a full file listing per call and read like an endpoint that exists.
  `comment list --thread <id>` covers the real need.
- **Resolving a comment** — the REST API cannot resolve or unresolve one.
  `resolved_at` is reported in the listing; changing it is Plugin-API territory.
- **Emoji shortcode validation against the accepted list** — Figma publishes it
  as an external emoji-mart data file rather than in any schema, so only the
  shortcode *shape* is checked locally, with the file linked in the error.

**Flags and behavior worth knowing:**

- `comment list` takes `--as-md` and `--thread <comment-id>`. Figma returns a
  file's root comments and every reply in one flat list with no parameter that
  narrows it, so `--thread` filters the response by `parent_id`.
- `comment create` pins with `--x/--y` (canvas), `--node-id` (offset inside a
  frame), and `--region-width/--region-height/--pin-corner` (region variants of
  each) — the four `client_meta` shapes, which differ only by which fields are
  present. `--node-id` accepts the `1-23` spelling from the URL bar.
- `--reply-to` must name a **root** comment; Figma rejects a reply to a reply.
- Both deletes go through `deleteIdempotently`, so a repeat reports
  `already_absent` rather than failing.
- Reactions are the only paginated read here (`url_cursor`: `--cursor`, `--all`,
  `--max-pages`). The comment list declares `none` and reports it, so a caller
  can tell "no more" from "never paginates".

**Traps handled:**

- `emoji` is a **query** parameter on the reaction delete, not a path segment.
- Figma takes an emoji **shortcode** (`:heart:`), never the character; a literal
  emoji is refused before a request is spent on it.
- Only the author may delete a comment; only the person who left a reaction may
  remove it. Both are `403`, the same status as an expired token, so both attach
  their own hint.
- Plan access tokens do not carry `file_comments:write` at all, so under
  `--auth-mode plan` every write in this domain is refused up front (exit 3)
  rather than round-tripping into a generic 403. Reads work normally.

**Testable without an Enterprise plan: yes.** Comments are Tier 2 and gated only
on ordinary file access — any plan, any seat that can comment. The system suite
needs `FIGMA_SYSTEM_TEST=1`, `FIGMA_ACCESS_TOKEN`, and `FIGMA_COMMENT_FILE_KEY`;
the write specs are opt-in again behind `FIGMA_COMMENT_WRITES=1` because
they post and delete real comments — use a file you own, since only the author
can delete what they posted. A plan access token can run the read specs only.

## dev-resources

**Endpoints covered — all four of the Dev Resources tag, no skips.**

| Endpoint | Tier | CLI | MCP tool |
| --- | --- | --- | --- |
| `GET /v1/files/{key}/dev_resources` | 2 | `cyber-figma dev-resource list <file> [--node-ids <ids>]` | `figma_dev_resource_list` |
| `POST /v1/dev_resources` | 2 | `cyber-figma dev-resource create <file> --node <ids> --name <name> --url <url>` | `figma_dev_resource_create` |
| `PUT /v1/dev_resources` | 2 | `cyber-figma dev-resource update <id> [--name] [--url]` | `figma_dev_resource_update` |
| `DELETE /v1/files/{key}/dev_resources/{id}` | 2 | `cyber-figma dev-resource delete <file> <id>` | `figma_dev_resource_delete` |

Nothing was deliberately skipped. Note the CLI and MCP surfaces differ in shape
on purpose: both writes are bulk endpoints, so the MCP tools take a `resources`
array (many links, many files, one call) while the CLI takes one link and
expands `--node a,b,c` into one request — the bulk path an agent reaches for at
a terminal.

### How the traps are handled

- **A 200 is not proof of success.** `POST` and `PUT /v1/dev_resources` answer
  `200` while carrying a per-item `errors` array. Every write goes through
  `summarizeWrite` in `write-result.ts` and comes back as
  `{ ok, action, requested, succeeded, failed, dev_resources, errors }`, so the
  count of what actually landed is in the JSON/TOON payload and in the text
  output alike — text prints `N of M dev resource(s) created` followed by every
  rejection by file/node or id. `ok` is true only when Figma reported no error
  at all.
- **Nothing written is a failure.** When every requested item was rejected, the
  api throws `DevResourceWriteFailed` (message naming each rejection, plus a
  hint listing the documented causes), so the CLI exits nonzero through the
  spine's handler instead of acknowledging a write that never happened. A
  *partial* success is not thrown: it exits 0 and reports the failures, because
  some of the work did land.
- **Main file keys only.** Branch keys are rejected by all four endpoints. Every
  `<file>` argument, MCP `file` param, and the domain help says "a MAIN file,
  not a branch".
- **Documented rejection causes** are carried in the failure hint: unknown file
  key, the node already holds the maximum of **10** dev resources, or another
  dev resource on that node already has the same URL.
- **Node id forms.** `--node-ids`/`--node` and the MCP `node_id` accept the URL
  bar's dashed form (`1-2`) and normalize to the API's `1:2`; a file argument
  accepts a pasted `figma.com/design/…` URL.
- **No publishing step.** Unlike components, styles, and variables, dev
  resources are live the moment they are written, including on
  already-published components. The help text says so, so nobody looks for a
  publish command that does not exist.

### Dev-Mode seat implications

The REST endpoints themselves carry **no plan gate** — they behave like ordinary
file-permission-scoped endpoints (read: any file access + `file_dev_resources:read`;
write: edit access + `file_dev_resources:write`). What is gated is the surface
these links appear in: per Figma's help center, **Dev Mode is available on paid
plans and requires a Full or a Dev seat**. So on a Starter plan or a View/Collab
seat the API still answers and the links are still stored — they are simply not
visible in the product. The domain help text states exactly this, so a caller
who sees a successful write but no link in the UI is not left guessing.

(Related, and outside this domain: the `Completed` Dev Mode status is
Organization/Enterprise only, which changes which statuses can fire the
`DEV_MODE_STATUS_UPDATE` webhook event.)

### Testing without an Enterprise plan

Yes — the whole domain is testable on any plan, including Starter, since no
endpoint here is Enterprise-gated. The live suite needs a **main** file key and,
to run the write round-trip, a node id in that file; without the node id only
the read contract runs, so a read-only credential still passes.

```sh
FIGMA_SYSTEM_TEST=1 FIGMA_ACCESS_TOKEN=<pat> \
  FIGMA_DEV_RESOURCE_FILE_KEY=<main-file-key> FIGMA_DEV_RESOURCE_NODE_ID=1-2 \
  pnpm cf test:system
```

The write specs create their links and delete them again, including on failure,
so a real file is left as it was found.

## files

**Endpoints covered — all six of the Files tag, no skips.**

| Endpoint | Tier | CLI | MCP tool |
| --- | --- | --- | --- |
| `GET /v1/files/{key}` | 1 | `cyber-figma file get <file>` | `figma_file_get` |
| `GET /v1/files/{key}/nodes` | 1 | `cyber-figma file nodes <file> --ids <ids>` | `figma_file_nodes` |
| `GET /v1/images/{key}` | 1 | `cyber-figma file images <file> --ids <ids>` | `figma_file_images` |
| `GET /v1/files/{key}/images` | 2 | `cyber-figma file image-fills <file>` | `figma_file_image_fills` |
| `GET /v1/files/{key}/meta` | 3 | `cyber-figma file meta <file>` | `figma_file_meta` |
| `GET /v1/files/{key}/versions` | 2 | `cyber-figma file versions <file>` | `figma_file_versions` |

Nothing was deliberately skipped.

### How the traps are handled

- **Tier-1 cost.** `get`, `nodes`, and `images` are Figma's costliest tier, and a
  View or Collab seat is allowed roughly 6 tier-1 calls per *month* on every
  plan. `file get` sends `depth=1` (pages only) when the caller narrowed neither
  `--ids` nor `--depth`; `--depth all` is the explicit way to ask for the whole
  tree. Every tier-1 command description and MCP tool description names the cost
  and points at `file meta` (tier 3) for listing and inspection flows.
- **Null renders.** A `null` url in `GET images` means *that node* failed to
  render; the call succeeded and every requested id is present as a key. The api
  returns `{ node_id, url, rendered }` rows plus `failed_node_ids`, and the text
  output says in words that this is a per-node outcome and not a failed call, so
  nothing retries a `null` as an error.
- **Expiring URLs.** Render results carry `url_expires_after_days: 30` and image
  fills `14`; both print an expiry warning in text mode. Neither is presented as
  a stable link.
- **Batching.** `file images` puts every requested id into one `GET /v1/images`
  call — Figma names batching as the primary way to avoid rate limits — and a
  unit test pins that one call is made regardless of id count.
- **Deep trees.** Node payloads are truncated in text mode through
  `truncate(..., { full: isFull() })`, which prints the total size and points at
  `--full`. Names are truncated in tables.
- **`scale` is the one fractional query param.** It goes through `floatParam()`
  so the client's integer coercion does not turn `1.5` into `1`, and a value
  outside 0.01–4 is rejected before the call is spent.
- **Version pagination.** `GET file versions` is the `url_page` model
  (`page_size` + `before`/`after`, answered as full page URLs); it declares that
  spec once, so the CLI flags and MCP params are derived from it.

### Testing without an Enterprise plan

Yes — the whole domain is testable on any plan. None of the six endpoints is
Enterprise-gated; they need only a token that can read the file. The one caveat
is quota rather than plan: the live suite spends tier-1 calls, so it is gated on
`FIGMA_FILE_KEY` and `FIGMA_NODE_ID` on top of `FIGMA_SYSTEM_TEST`, and skips
itself when they are unset.

```sh
FIGMA_SYSTEM_TEST=1 FIGMA_ACCESS_TOKEN=<pat> FIGMA_FILE_KEY=<key> FIGMA_NODE_ID=1-2 pnpm cf test:system
```

## library (components, component sets, styles)

Implemented in `packages/cyber-figma/src/library/`, registered as **three**
domains — `component`, `component-set`, `style` — out of one implementation,
because the three families are the same three endpoints over three path
segments and differ only in their nouns and in the `style_type` field.

### Endpoints covered (9 of 9)

| Endpoint | CLI | MCP tool |
| --- | --- | --- |
| `GET /v1/teams/{team_id}/components` | `component team-list [team]` | `figma_component_team_list` |
| `GET /v1/files/{file_key}/components` | `component file-list <file>` | `figma_component_file_list` |
| `GET /v1/components/{key}` | `component get <key>` | `figma_component_get` |
| `GET /v1/teams/{team_id}/component_sets` | `component-set team-list [team]` | `figma_component_set_team_list` |
| `GET /v1/files/{file_key}/component_sets` | `component-set file-list <file>` | `figma_component_set_file_list` |
| `GET /v1/component_sets/{key}` | `component-set get <key>` | `figma_component_set_get` |
| `GET /v1/teams/{team_id}/styles` | `style team-list [team]` | `figma_style_team_list` |
| `GET /v1/files/{file_key}/styles` | `style file-list <file>` | `figma_style_file_list` |
| `GET /v1/styles/{key}` | `style get <key>` | `figma_style_get` |

Nothing in this family was skipped. All nine are read-only; Figma publishes no
write endpoints for components, component sets, or styles (publishing happens in
the editor, not over REST).

### Traps handled

- **Published only.** Every CLI subcommand description, every MCP tool
  description, and the file-scoped error hint say so outright — an unpublished
  component is absent from these responses, so a correct empty answer otherwise
  reads as a broken command.
- **Main file key only.** The `<file>` argument and the `file` tool parameter
  both say a branch key cannot work, because branches cannot publish.
- **Pagination.** The team lists declare `id_cursor` (`page_size` default 30,
  max 1000, opaque integer `before`/`after`), so the CLI offers
  `--page-size/--before/--after/--all/--max-pages` and no `--cursor`; the file
  lists declare `none` and offer nothing. Both run the shared
  `defineListPaginationAcceptanceSpecs` contract.
- **Scopes.** The three differ by scope of access, and Figma refuses a missing
  one with the same 401/403 it uses for a missing file, so each operation
  attaches its own: `team_library_content:read` (team),
  `library_content:read` (file), `library_assets:read` (by key).

### Plan requirements

**Fully testable without an Enterprise plan.** No plan gate: all nine are
rate-limit tier 3 and available on every plan to any seat, with both personal
and plan access tokens. The only requirement is a team with a published library.

System suite: `src/library/gateway.system.ts`, gated on `FIGMA_SYSTEM_TEST` +
`FIGMA_ACCESS_TOKEN` + `FIGMA_TEAM_ID` + `FIGMA_LIBRARY_FILE_KEY` (a main file
key with published content). `FIGMA_LIBRARY_MULTIPAGE=1` enables the multi-page
specs on an account whose team library exceeds one page of 30.

### Spine note for the operator

`printNextPageHint` in `src/cli-options.ts` always prints `--cursor <value>`,
but the `id_cursor` and `url_page` models advance on `--after` — `collectPages`
already knows this (`advanceWith`). The hint is wrong for those two models, so
this domain prints its own `--after` next step instead of calling it. A spine
fix would be to derive the flag from the model, the way `addPaginationOptions`
already does.

## oembed

**Endpoints covered — the whole oEmbed tag (1 endpoint), no skips.**

| Endpoint | Tier | CLI | MCP tool |
| --- | --- | --- | --- |
| `GET /v1/oembed` | 3 | `cyber-figma oembed get <url> [--max-width] [--max-height]` | `figma_oembed_get` |

### How the traps are handled

- **Plan access tokens cannot reach it.** Refused in `api.ts` *before* the
  request is sent, naming the credential mode — Figma answers a plan token with
  the same 403 it uses for an expired token, which sends the reader after the
  wrong cause.
- **It takes a URL, not a file key.** Every other command in the CLI takes a
  file key, so the mix-up is the likely one: a non-URL argument is rejected with
  the URL to use instead (`https://www.figma.com/design/<key>`), without
  spending a request.
- **501 is unique to this endpoint.** The spine's generic 5xx hint ("retry with
  fewer nodes") would mislead, so a 501 gets its own hint: Figma produced no
  embed for that URL — check it is a Figma file or a published Make site, and
  that it is shared beyond "only invited people".
- **The iframe HTML is truncated** by default like any large free-text field;
  `--full` prints it whole. `--json`/`--toon` always carry it complete.

**Testable without Enterprise: yes.** No plan gate; scope `file_metadata:read`.
The live suite needs `FIGMA_OEMBED_URL` (a file or published Make URL the
credential can see) and a personal or OAuth credential.

## projects

**Endpoints covered — the whole Projects tag (3 endpoints), no skips.** The tag
is entirely read-only; Figma's REST API creates and deletes no projects at all.

| `GET /v1/teams/{team_id}/projects` | 2 | `cyber-figma project list [team]` | `figma_project_list` |
| `GET /v1/projects/{project_id}/meta` | 3 | `cyber-figma project get <project>` | `figma_project_get` |
| `GET /v1/projects/{project_id}/files` | 2 | `cyber-figma project files <project> [--branch-data]` | `figma_project_files` |

### The discovery walk

This domain is the entry point, so each listing names the next call through
`printNextSteps`: `project list` → `project files <id>` / `project get <id>`,
`project files` → `file get <key>` / `comment list <key>`, and `user me` →
`project list --team <id>`. A team id is the one identifier Figma will not hand
you, so the walk starts where the spine's `scope.ts` resolves it from
(`--team` / `FIGMA_TEAM_ID` / `.agents/cyber-figma.json` / a pasted team URL) —
none of that is reimplemented here.


- **No team-id discovery endpoint.** Team resolution is the spine's
  `requireTeamId`, whose failure message says where in the URL bar to find one.
  A missing team id surfaces as a rejected promise, not a throw at call time.
- **Project ids come from the URL bar too.** `project get` and `project files`
  accept a bare id or a `figma.com/files/team/<id>/project/<id>/…` URL, and a
  Figma URL naming no project is rejected by name.
- **All three endpoints return everything at once** (`model: 'none'`), so no
  command advertises a `--cursor` the endpoint does not have; the result still
  comes back in the spine's uniform `PaginatedResult` shape.
- **`branch_data` has no response field in the OpenAPI spec.** The parameter is
  declared and documented but nothing types what it returns, so the extra data
  is passed through unnamed rather than invented — it reaches `--json` intact.
  Recorded under "Known spec defects" in `docs/research/figma-rest-api.md`.

**Testable without Enterprise: yes.** No plan gate on any of the three; scopes
`projects:read` and `project_metadata:read`, both reachable with a PAT, an
OAuth token, and a plan token. The live suite needs `FIGMA_TEAM_ID`.

## users

**Endpoints covered — the whole Users tag (1 endpoint), no skips.**

| `GET /v1/me` | 3 | `cyber-figma user me` | `figma_user_me` |

**Deliberately not covered:** Figma's SCIM API. It is a separate API with its
own base URL and auth, is explicitly "distinct from the Figma REST API", and is
out of scope for a REST-API wrapper.


- **Plan access tokens cannot reach it.** A plan token is minted for an
  organization and is not tied to a user, so the refusal is certain: the api
  refuses it up front, names the credential mode as the cause, and points at the
  file-scoped alternative for verifying a plan token. Without this, the caller
  gets a bare 403 that reads exactly like an expired PAT.
- **`email` is unique to this endpoint** — it is in the output for that reason,
  and the acceptance contract asserts it is present.

**Testable without Enterprise: yes.** No plan gate; scope `current_user:read`.
The live suite needs only `FIGMA_SYSTEM_TEST` plus a personal or OAuth
credential — no extra configuration.

## variables

**Endpoints covered — all three, no skips.**

| Endpoint | Where |
| --- | --- |
| `GET /v1/files/{file_key}/variables/local` | `variable list`, `variable collections`, `variable get` |
| `GET /v1/files/{file_key}/variables/published` | the same three with `--published` |
| `POST /v1/files/{file_key}/variables` | `variable apply` |

Both read endpoints answer with variables *and* collections in one payload, so
the three read commands are views of one request, not three round trips.

### CLI commands

| Command | Notes |
| `cyber-figma variable list <file> [--published] [--collection <id>]` | Variables as a list, not the id-keyed map Figma sends. `--collection` filters client-side; Figma has no server-side filter for it |
| `cyber-figma variable collections <file> [--published]` | Collections with their modes. The published view omits modes, and the table says so instead of showing a blank cell |
| `cyber-figma variable get <file> <variable-id> [--published]` | Resolves the `variableId` a node carries in `boundVariables`. Not a Figma endpoint — Figma has no by-id variable read, so this is the local read plus a lookup |
| `cyber-figma variable apply <file> --changes <json\|@path> [--dry-run]` | The batch write. `--dry-run` validates and reports what it would touch without sending |

### MCP tools

`figma_variable_list`, `figma_variable_collection_list`, `figma_variable_get`,
`figma_variable_apply` (which takes `dry_run`). Every description states the
Enterprise requirement, because a client reads the tool list to decide whether
to call at all.

### Testable without an Enterprise plan?

**No — not against Figma, reads included.** Variables is Enterprise-gated on
read as well as write, `POST` additionally needs a Full seat or admin and Edit
access on the file and is unreachable with a plan access token, and guests are
excluded even on Enterprise. Nothing in this domain was verified against a live
Figma account.

What stands in for that:

- `gateway.acceptance.test.ts` runs the domain's acceptance specs against an
  in-memory Figma Variables backend whose `POST` really applies the batch — in
  the documented array order, with the documented temporary-id mapping — rather
  than echoing the request back.
- `plan-gate.test.ts` proves the spine's plan-gate classification fires for
  these paths: a 401 or 403 on any of the five operations is `plan_gated` with
  exit code 7 and an Enterprise hint, while a 404 stays not-found (5) and a 429
  stays rate-limited (6). The domain writes no status-code handling of its own.
- `changes.ts` validates a change set before the request, against what Figma
  documents: action shape per array, ids on UPDATE/DELETE, 40 modes per
  collection, mode names ≤ 40 characters, 5000 variables per collection, unique
  names within a collection, the forbidden `.{}` name characters, and value
  types against the `resolvedType` of a variable created in the same request.
  It never rejects something Figma would have accepted; anything that depends on
  the file's current contents is left to Figma.
- `gateway.system.ts` runs the same acceptance specs live, gated on
  `FIGMA_VARIABLES_FILE_KEY` (an Enterprise file) and skipping cleanly without
  it. Writes are gated a second time on `FIGMA_VARIABLES_WRITE`, because `POST
  variables` mutates a real design file and REST has no publish or undo.

### Deliberately not built

- **Publishing.** Variables written through REST stay invisible to other files
  until the library is published, and Figma exposes no publish endpoint — it is
  a UI action. Every write path says so in its acknowledgement rather than
  implying the change is live.
- **Branch-key guard on `--published`.** That endpoint requires a main file key;
  the flag description says so, but nothing here rejects a branch key, because a
  key's branch-ness is not knowable without another request.

## webhooks

**Endpoints covered — all 7 in the Webhooks v2 family.**

| Endpoint | CLI | MCP tool |
| --- | --- | --- |
| `GET /v2/webhooks` (context and plan forms) | `webhook list [--context] [--context-id] [--plan]` | `figma_webhook_list` |
| `POST /v2/webhooks` ✏️ | `webhook create` | `figma_webhook_create` |
| `GET /v2/webhooks/{id}` | `webhook get <id>` | `figma_webhook_get` |
| `PUT /v2/webhooks/{id}` ✏️ | `webhook update <id>` | `figma_webhook_update` |
| `DELETE /v2/webhooks/{id}` ✏️ | `webhook delete <id>` | `figma_webhook_delete` |
| `GET /v2/webhooks/{id}/requests` | `webhook requests <id> [--failed-only]` | `figma_webhook_requests` |
| `GET /v2/teams/{team_id}/webhooks` **[deprecated]** | `webhook list-team [team]` | — (deliberately not exposed) |

**Deliberately skipped**

- **No MCP tool for the deprecated team list.** Figma marks
  `GET /v2/teams/{id}/webhooks` deprecated and superseded by
  `GET /v2/webhooks?context=team`. The CLI keeps it as a compatibility shim for
  tooling that still calls the old path, but an agent reading the tool listing
  should only ever see the endpoint that replaced it.
- **The deprecated `team_id` field on the create body.** Superseded by
  `context`/`context_id`, which is what the domain sends.
- **No confirmation prompt on delete.** The CLI is non-interactive by contract;
  `webhook delete` is already an explicit command and goes through
  `deleteIdempotently`, so a repeat delete reports `already_absent` rather than
  failing.

**Notes on the write surface**

- A passcode is masked (`***`) by the api layer on every path out, including
  `--json`, `--toon`, and MCP tool output — Figma blanks it on `GET` but echoes
  the real one back from `POST` and `PUT`. The CLI takes it in with
  `--passcode-env <VAR>` so it need not appear in shell history or `ps`.
- Endpoint URLs are validated before Figma is asked to call them: absolute,
  `https` (Figma answers plain HTTP with a 403), and within 2048 characters.
- A 401/403 on a create names the role that context requires — team admin for a
  team, "Can edit" for a project or file — plus the per-context cap (20/team,
  5/project, 3/file) and the expired-PAT-reports-as-403 trap.
- Creating `--status PAUSED` is surfaced in the CLI help, the create output, and
  the MCP tool description, because an `ACTIVE` webhook makes Figma POST a PING
  to the endpoint immediately.

**Testable without an Enterprise plan: yes.** Webhooks v2 is available on every
plan that has the REST API; reads need `webhooks:read` and writes need
`webhooks:write` plus team-admin or edit rights on the context. The system
suite runs reads on `FIGMA_TEAM_ID` alone; the lifecycle spec (create → get →
update → delete → repeat delete) is opt-in on `FIGMA_WEBHOOK_SYSTEM_ENDPOINT`
because it writes to a real team, and it creates the webhook `PAUSED` so
nothing is ever delivered to that URL. Only the paginated form of
`GET /v2/webhooks` needs a plan api id
(`FIGMA_WEBHOOK_SYSTEM_PLAN_API_ID`); the `organization-<orgId>` form of it is
the only part of the domain a Professional plan cannot reach.

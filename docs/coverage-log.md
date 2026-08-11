# Coverage log

What each domain pod shipped, endpoint by endpoint. One section per domain,
alphabetical. Sections are additive — resolve a conflict here by keeping every
side's section.

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

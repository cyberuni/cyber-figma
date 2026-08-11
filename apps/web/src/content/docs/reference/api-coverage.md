---
title: API coverage
description: Every Figma REST API endpoint group, its status in cyber-figma, and what it costs to call.
sidebar:
  order: 2
---

`cyber-figma` is a curated wrapper, not a 1:1 mirror of the
[Figma REST API](https://developers.figma.com/docs/rest-api/). This page tracks what is
implemented, group by group.

:::caution[Nothing is implemented yet]
Every row below is **planned**. `cyber-figma` is at the scaffolding stage; the domain pods
flip these statuses as each resource lands. If a row still says *Planned*, the command and
the tool do not exist yet.
:::

Coverage is measured against Figma's own
[OpenAPI specification](https://github.com/figma/rest-api-spec), **v0.41.0**, retrieved
2026-08-11. That spec is labelled **beta** by Figma; where it and the prose docs disagree,
the prose docs win.

## Legend

| Status | Meaning |
| --- | --- |
| ✅ | Fully covered — every operation in the group is reachable |
| 🟡 | Partially covered |
| 📋 | **Planned** — not implemented yet |
| 🚫 | Out of scope — deliberately not wrapped |

Every operation, once implemented, is reachable from **both** the CLI and the MCP server.
They share the same core, so nothing will be CLI-only or MCP-only.

## Surface size

The API is **53 HTTP operations**: 50 in the OpenAPI spec, plus the Discovery endpoint
(documented but *absent from the spec*), plus 2 OAuth token endpoints. Of the 50 spec
operations, **11 mutate** and 39 are read-only.

Nothing in the REST API creates or deletes **files, projects, teams, pages, or nodes**. The
write surface is deliberately narrow: comments, reactions, webhooks, variables, and dev
resources. Any "edit the design" capability lives in the Plugin API, not here.

## Coverage by endpoint group

| Endpoint group | Ops | Status | CLI namespace | Rate tier | Plan gate |
| --- | --- | --- | --- | --- | --- |
| [Files](#files) | 6 | 📋 Planned | `file` | 1–3 | — |
| [Projects](#projects) | 3 | 📋 Planned | `project` | 2–3 | — |
| [Comments](#comments) | 3 | 📋 Planned | `comment` | 2 | — |
| [Comment Reactions](#comment-reactions) | 3 | 📋 Planned | `comment` | 2 | — |
| [Users](#users) | 1 | 📋 Planned | `user` | 3 | — |
| [Components, Component Sets, Styles](#components-component-sets-and-styles) | 9 | 📋 Planned | `component`, `component-set`, `style` | 3 | — |
| [Webhooks v2](#webhooks-v2) | 7 | 📋 Planned | `webhook` | 2 | — |
| [Variables](#variables) | 3 | 📋 Planned | `variable` | 2–3 | **Enterprise** |
| [Dev Resources](#dev-resources) | 4 | 📋 Planned | `dev-resource` | 2 | — |
| [Library Analytics](#library-analytics) | 6 | 📋 Planned | `analytics` | 3 | **Enterprise** |
| [Activity Logs](#activity-logs) | 1 | 📋 Planned | `activity-log` | 3 | **Enterprise**, org admin |
| [Developer Logs](#developer-logs) | 1 | 📋 Planned | `developer-log` | 3 | **Enterprise + Governance+** |
| [AI Usage](#ai-usage) | 1 | 📋 Planned | `ai-usage` | 3 | **Enterprise**, org admin |
| [Discovery](#discovery) | 1 | 📋 Planned | `discovery` | 2 | **Enterprise + Governance+** |
| [Payments](#payments) | 1 | 📋 Planned | `payment` | 3 | — |
| [oEmbed](#oembed) | 1 | 📋 Planned | `oembed` | — | — |
| [OAuth token endpoints](#oauth-token-endpoints) | 2 | 🚫 Deferred | — | — | — |
| [SCIM](#scim) | — | 🚫 Out of scope | — | — | Organization+ |

CLI namespaces are the intended shape and are not final until each domain lands. Plan gates
and rate tiers are explained on
[Plans and limits](/cyber-figma/reference/plans-and-limits/).

## Operation-level inventory

### Files

Six read-only operations.

| Operation | Endpoint | Tier | Status |
| --- | --- | --- | --- |
| Get file JSON | `GET /v1/files/{file_key}` | 1 | 📋 |
| Get JSON for specific nodes | `GET /v1/files/{file_key}/nodes` | 1 | 📋 |
| Render images of nodes | `GET /v1/images/{file_key}` | 1 | 📋 |
| Get image fills | `GET /v1/files/{file_key}/images` | 2 | 📋 |
| Get file metadata | `GET /v1/files/{file_key}/meta` | 3 | 📋 |
| Get version history | `GET /v1/files/{file_key}/versions` | 2 | 📋 |

Things a wrapper has to get right here:

- `GET file` returns the **whole document tree** with no pagination. Large files commonly
  answer `400` or `500` on timeout, so `depth` and `ids` have to be used aggressively — and
  a default that fetches everything is a bug, not a convenience.
- **`GET file meta` is Tier 3 while `GET file` is Tier 1**, so metadata-first listing flows
  are roughly 15× cheaper.
- Rendered image URLs **expire after 30 days**; image-fill URLs expire after **no more
  than 14 days**.
- On `GET images`, a `null` value in the `images` map means *that node* failed to render,
  not that the request failed. Every requested node ID appears as a key regardless, so a
  `null` must never be retried as an error.
- `editorType` on `GET file meta` has a **wider enum** than on `GET file`
  (`figma | figjam | slides | buzz | sites | make` versus `figma | figjam`). They are not
  the same type.

### Projects

| Operation | Endpoint | Tier | Status |
| --- | --- | --- | --- |
| Get projects in a team | `GET /v1/teams/{team_id}/projects` | 2 | 📋 |
| Get project metadata | `GET /v1/projects/{project_id}/meta` | 3 | 📋 |
| Get files in a project | `GET /v1/projects/{project_id}/files` | 2 | 📋 |

There is **no endpoint to discover a team ID from a token** — Figma says so explicitly. The
ID must be read out of the team page URL, which is why `FIGMA_TEAM_ID` exists.

### Comments

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get comments in a file | `GET /v1/files/{file_key}/comments` | 📋 |
| Add a comment ✏️ | `POST /v1/files/{file_key}/comments` | 📋 |
| Delete a comment ✏️ | `DELETE /v1/files/{file_key}/comments/{comment_id}` | 📋 |

Replies must target a **root comment** — you cannot reply to a reply. Only the author may
delete a comment. Writing comments requires `file_comments:write`, which **plan access
tokens cannot use**.

### Comment Reactions

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get reactions | `GET /v1/files/{file_key}/comments/{comment_id}/reactions` | 📋 |
| Add a reaction ✏️ | `POST /v1/files/{file_key}/comments/{comment_id}/reactions` | 📋 |
| Delete a reaction ✏️ | `DELETE /v1/files/{file_key}/comments/{comment_id}/reactions` | 📋 |

`emoji` is an **emoji shortcode** (`:heart:`, `:+1::skin-tone-2:`), and on the `DELETE` it
is a required **query** parameter rather than a path segment. Only the person who made a
reaction may remove it.

### Users

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get the current user | `GET /v1/me` | 📋 |

The `email` field appears **only** on this endpoint. It is the natural "verify my
credentials" command, but **plan access tokens cannot call it**, so a connection check must
fall back to something else in that mode.

### Components, Component Sets, and Styles

Three parallel families with identical shapes — nine operations, all read-only, all Tier 3.

| Resource | Team-scoped (paginated) | File-scoped | By key |
| --- | --- | --- | --- |
| Components | `GET /v1/teams/{team_id}/components` | `GET /v1/files/{file_key}/components` | `GET /v1/components/{key}` |
| Component Sets | `GET /v1/teams/{team_id}/component_sets` | `GET /v1/files/{file_key}/component_sets` | `GET /v1/component_sets/{key}` |
| Styles | `GET /v1/teams/{team_id}/styles` | `GET /v1/files/{file_key}/styles` | `GET /v1/styles/{key}` |

All nine are 📋 Planned. **They return only *published* library content**, not every
component in a file. The file-scoped variants require a **main file key, not a branch
key**, because branches cannot publish.

### Webhooks v2

The only family not on `/v1/`. Four reads, three writes.

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get webhooks by context or plan | `GET /v2/webhooks` | 📋 |
| Create a webhook ✏️ | `POST /v2/webhooks` | 📋 |
| Get a webhook | `GET /v2/webhooks/{webhook_id}` | 📋 |
| Update a webhook ✏️ | `PUT /v2/webhooks/{webhook_id}` | 📋 |
| Delete a webhook ✏️ | `DELETE /v2/webhooks/{webhook_id}` | 📋 |
| Get webhook requests | `GET /v2/webhooks/{webhook_id}/requests` | 📋 |
| Get team webhooks — **deprecated** | `GET /v2/teams/{team_id}/webhooks` | 🚫 |

The deprecated team-scoped list is superseded by `GET /v2/webhooks?context=team&context_id=…`
and will not be surfaced except, if needed, as a compatibility shim.

Event types: `PING`, `FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_DELETE`,
`LIBRARY_PUBLISH`, `FILE_COMMENT`, `DEV_MODE_STATUS_UPDATE`. A `PUT` does **not** accept
`context` / `context_id`, so a webhook cannot be re-targeted. Figma retries a failed
delivery **3 times with exponential backoff — at 5 minutes, 30 minutes, and 3 hours** — and
does *not* auto-deactivate persistently failing endpoints. There is no UI for webhooks; the
API is the only management surface.

### Variables

**Enterprise-only.**

| Operation | Endpoint | Tier | Status |
| --- | --- | --- | --- |
| Get local variables | `GET /v1/files/{file_key}/variables/local` | 2 | 📋 |
| Get published variables | `GET /v1/files/{file_key}/variables/published` | 2 | 📋 |
| Create / modify / delete ✏️ | `POST /v1/files/{file_key}/variables` | **3** | 📋 |

`GET local` is the only place to read **mode values**; the published endpoint omits modes.
The bulk write applies its arrays in a fixed order — collections, then modes, then
variables, then mode values — and returns a `tempIdToRealId` map.

:::caution
**Variables changed via REST must be published before other files see them, and publishing
is not a REST operation.** It is a UI or plugin action, so a REST-only workflow cannot
complete the round trip.
:::

Limits: **40 modes per collection**, mode names ≤ 40 characters, **5000 variables per
collection**.

### Dev Resources

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get dev resources | `GET /v1/files/{file_key}/dev_resources` | 📋 |
| Bulk create ✏️ | `POST /v1/dev_resources` | 📋 |
| Bulk update ✏️ | `PUT /v1/dev_resources` | 📋 |
| Delete a dev resource ✏️ | `DELETE /v1/files/{file_key}/dev_resources/{dev_resource_id}` | 📋 |

Unlike variables, components, and styles, dev resources **do not need to be published** —
they are live immediately.

:::caution[A 2xx is not proof of success]
The bulk create and update endpoints have **partial-success semantics**: a `200` can come
back with an `errors` array alongside `links_created` / `links_updated`. Documented failure
causes are an unknown `file_key`, a node already holding the **maximum of 10 dev
resources**, and a duplicate URL on the same node. A client must inspect `errors`.
:::

### Library Analytics

Six read-only endpoints under `GET /v1/analytics/libraries/{file_key}/…`, all
**Enterprise-only**, all 📋 Planned.

| Path suffix | `group_by` (required) | Date range? |
| --- | --- | --- |
| `/component/actions` | `component` \| `team` | ✅ |
| `/component/usages` | `component` \| `file` | ❌ |
| `/style/actions` | `style` \| `team` | ✅ |
| `/style/usages` | `style` \| `file` | ❌ |
| `/variable/actions` | `variable` \| `team` | ✅ |
| `/variable/usages` | `variable` \| `file` | ❌ |

The `…/actions` endpoints are **time series** and take `start_date` / `end_date`; the
`…/usages` endpoints are a **snapshot** and take no date range at all. Data is recalculated
**daily at 00:00 UTC**, so polling more often is wasted. Rows the requesting user cannot
see are **name-obfuscated** rather than dropped — they appear as `Team not visible` /
`File not visible`, and must not be aggregated as a single real entity.

### Activity Logs

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get activity logs | `GET /v1/activity_logs` | 📋 |

**Enterprise-only, org admins only.** Requires org OAuth 2 with `org:activity_log_read`, or
a plan access token — the spec does **not** list personal access tokens for this endpoint.

:::note[Asymmetric pagination]
The response advertises a `cursor` and `next_page`, but **no `cursor` request parameter is
documented** — there is nothing to pass it back to. Until Figma clarifies this, paging
means shifting the `start_time` / `end_time` window and using `order`.
:::

### Developer Logs

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get developer logs | `POST /v1/developer_logs` | 📋 |

A **`POST` that reads** — filters go in the body, not the query string. It is not a
mutation. **Enterprise + Governance+, org admins only, plan access token only.** Records are
retained **30 days only**, and the logs cover both REST API and **MCP server** requests.

### AI Usage

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get daily AI usage | `GET /v1/ai_usage/daily` | 📋 |

**Enterprise-only, org admins, plan access token only.** `start_date` must be on or after
**2025-12-01** and no more than 366 days before today. A `user_email` matching no Figma user
returns **`400`**, not an empty list. Data **lags real time by 5–6 hours**, so current-day
figures are unreliable.

### Discovery

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get text events | `GET /v1/discovery` | 📋 |

:::caution[Not in the OpenAPI spec]
Discovery is documented only in prose, at
[developers.figma.com/docs/rest-api/discovery-endpoints/](https://developers.figma.com/docs/rest-api/discovery-endpoints/).
Any client generated from Figma's spec will simply be missing it — and absence cannot be
detected by reading the spec, so other omissions may exist.
:::

**Enterprise + Governance+, org admins only, OAuth 2 only.** It is a two-stage API: the
endpoint returns S3 download links keyed by hour, and you then fetch the JSON blobs.
`start_date` must be **at least 1 hour in the past**, and `end_date` cannot be more than
**24 hours** after it. Its error table is its own: `429` is documented as *"more than 20 per
second"*.

### Payments

| Operation | Endpoint | Status |
| --- | --- | --- |
| Validate a purchase | `GET /v1/payments` | 📋 |

**Personal access token only** — the docs state plainly that the Payments REST API does not
support OAuth 2, and the spec lists no plan-token support either. You can only query
resources you own.

### oEmbed

| Operation | Endpoint | Status |
| --- | --- | --- |
| Get an oEmbed response | `GET /v1/oembed` | 📋 |

Follows the [oEmbed 1.0 spec](https://oembed.com/). Requires `file_metadata:read` and is
**not usable with a plan access token**. Distinctively, it is the only endpoint in the spec
that can return **`501 Not Implemented`**.

### OAuth token endpoints

`GET https://www.figma.com/oauth`, `POST /v1/oauth/token`, and `POST /v1/oauth/refresh` are
part of the HTTP surface but are not in the OpenAPI spec. `cyber-figma`
[defers OAuth 2](/cyber-figma/authentication/#oauth-2) — a local CLI should not carry a
callback server and an app-review lifecycle.

### SCIM

🚫 **Out of scope.** Figma's SCIM API is explicitly *"distinct from the Figma REST API"* —
a different host (`https://www.figma.com/scim/v2/:tenantid`), different endpoints, and its
own bearer token. It manages user lifecycle, not the design surface a REST wrapper is for.

## Pagination

Figma uses **four different pagination models**, which is the single biggest source of
implementation drift. `cyber-figma` normalizes them into one options shape and one result
shape.

| Model | Where | Request | Response |
| --- | --- | --- | --- |
| **A. Full-URL links** | File versions, comment reactions, `GET /v2/webhooks` with `plan_api_id` | `page_size`, `before`, `after`, or `cursor` | `pagination: { prev_page?, next_page? }` — complete URLs to call |
| **B. Integer id-cursor** | Team components, component sets, styles | `page_size` (default 30, max **1000** for components), `before` / `after` — mutually exclusive, opaque | `meta.cursor: { before?, after? }` |
| **C. Opaque cursor + boolean** | All 6 Library Analytics endpoints | `cursor` | `{ rows, next_page: boolean, cursor? }`, max **1000 rows/page** |
| **D. Opaque cursor + a "more?" boolean** | AI Usage, Developer Logs | `cursor`, `limit` | AI Usage: `next_cursor` + `has_next_page`. Developer Logs: `cursor` + `has_more`. **Same model, different field names.** |

**Most endpoints do not paginate at all** and return the complete set in one response —
including `GET file`, `GET file nodes`, `GET images`, `GET file comments`, `GET team
projects`, `GET project files`, every Variables endpoint, and every Dev Resources endpoint.
On a large file or team that is a real scaling hazard, not a convenience.

`GET /v1/activity_logs` is its own case: it has a `limit` (default **1000**) but no usable
cursor.

## Known spec defects

Figma's OpenAPI specification has verified defects that a code generator will faithfully
reproduce as bugs, which is why `cyber-figma` does **not** generate its client from it.
All re-verified against v0.41.0 on 2026-08-11.

| Defect | Status in v0.41.0 | What it costs you |
| --- | --- | --- |
| Integer params typed `number` ([#86](https://github.com/figma/rest-api-spec/issues/86)) | **Still present, and broader than reported** — 15 params across 6 endpoints | Generators serialize `30` as `30.0`; Figma answers `400 "'page_size' must be a valid number, received type String"`. Coerce to integer at the client boundary |
| `GetFileNodesResponse` missing `err` ([#81](https://github.com/figma/rest-api-spec/issues/81)) | Still present | A spec-typed client discards a field the API returns |
| `err` typed as always-`null` on `GET images` | Still present | On a `400`, `err` carries the diagnostic naming the invalid parameter — the best error detail the API gives. Type it `string \| null` |
| Analytics param named `file_key` vs the docs' `library_file_key` ([#28](https://github.com/figma/rest-api-spec/issues/28)) | Still present | Cosmetic; affects generated naming only |
| `GetFileResponse` missing `linkAccess` ([#30](https://github.com/figma/rest-api-spec/issues/30)) | **Fixed** — present in v0.41.0, though the issue is still open | None; ignore the issue |

## Errors

| Code | Meaning, and the non-obvious causes |
| --- | --- |
| `400` | Invalid or malformed parameters — **and also returned when the requested resources are too large and the request times out** |
| `401` | Token missing or incorrect. Notably **not** declared on the Files endpoints |
| `403` | Valid request, refused: insufficient permissions, an HTTP rather than HTTPS request, **or an expired/invalid token**. So token expiry presents as `403`, not `401` |
| `404` | File or resource not found |
| `429` | Rate limited — see [Plans and limits](/cyber-figma/reference/plans-and-limits/) |
| `500` | Internal error, "most commonly occurs for very large image render requests" |
| `501` | oEmbed only |

## Documented gaps

Stated as gaps rather than guessed at:

- **No file, project, or team creation or deletion, and no node editing.** Not exposed by
  the REST API at all — that lives in the Plugin API.
- **No publish endpoint.** Variables written via REST must be published before other files
  see them, but publishing is a UI or plugin action.
- **No team-ID discovery.** Explicitly acknowledged by Figma.
- **`selections:read`** is a documented OAuth scope with **no documented endpoint that
  consumes it**.
- **`file_code_connect:write`** is referenced on the plan-access-tokens page but is absent
  from the published scopes table.
- **Activity Logs cursor pagination** — the response returns a cursor with nowhere to send
  it back.
- **The accepted emoji shortcode list** lives in an external file linked from the docs, not
  in any schema.
- **Personal access token count limits and rotation** are undocumented; there is no
  auto-rotation.

## Sources

- [Figma REST API documentation](https://developers.figma.com/docs/rest-api/)
- [Figma OpenAPI specification](https://github.com/figma/rest-api-spec) — v0.41.0
- [Errors](https://developers.figma.com/docs/rest-api/errors/)
- [Discovery endpoints](https://developers.figma.com/docs/rest-api/discovery-endpoints/)
- In-repo research: [`docs/research/figma-rest-api.md`](https://github.com/cyberuni/cyber-figma/blob/main/docs/research/figma-rest-api.md)

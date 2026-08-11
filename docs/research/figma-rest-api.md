# Figma REST API — endpoint inventory

Research document for `cyber-figma`. This is the spec other pods implement against.

**Primary sources**

- Official OpenAPI specification: <https://github.com/figma/rest-api-spec> (`openapi/openapi.yaml`), **version 0.41.0** — retrieved 2026-08-11. This is Figma's own machine-readable contract and is the authority for every method, path, parameter, and response shape below.
- Narrative docs: <https://developers.figma.com/docs/rest-api/> (the old `https://www.figma.com/developers/api` URL now 301-redirects here).
- Plan/seat gating, scopes, and rate limits are covered in the companion doc: [`figma-plans-and-limits.md`](./figma-plans-and-limits.md).

**Base URL:** `https://api.figma.com` (Figma for Government: `https://api.figma-gov.com`). SCIM is a *different* API on a different host — see [SCIM](#scim-separate-api).

**Surface size:** 50 operations in the OpenAPI spec, plus 1 Discovery endpoint that is documented but *not* in the spec, plus 2 OAuth token endpoints = **53 HTTP operations total**. Of the 50 spec operations, **11 are mutating** and 39 are read-only (see [Mutating vs read-only](#mutating-vs-read-only)).

> Note on the spec's own status: Figma labels the OpenAPI specification a **beta** artifact "given the large surface area and complexity of the REST API" (openapi.yaml `info.description`). Where the spec and the prose docs disagree, prefer the prose docs and re-verify.

**Full research record** — question framing, evidence log with confidence ratings, contradictions, and recheck triggers — lives in [`.research/figma-rest-api-surface/`](../../.research/figma-rest-api-surface/conclusion.md). Read that first if you need to know how confident a claim below is or when it should be revisited. This file is the reference inventory; the conclusion there is the verdict.

> ## ⚠️ Do not code-generate a client from the spec
>
> The spec has verified defects that a generator will faithfully reproduce as bugs. See [Known spec defects](#known-spec-defects) before writing the gateway. The short version: **coerce integer query parameters at the boundary**, and type `err` as `string | null`.

---

## Table of contents

- [Conventions](#conventions)
- [Known spec defects](#known-spec-defects) ← read this before writing the client
- [Pagination models](#pagination-models) ← read this before implementing any list command
- [Files](#files) (6)
- [Projects](#projects) (3)
- [Comments](#comments) (3)
- [Comment Reactions](#comment-reactions) (3)
- [Users](#users) (1)
- [Components, Component Sets, Styles](#components-component-sets-styles) (9)
- [Webhooks v2](#webhooks-v2) (7)
- [Variables](#variables) (3)
- [Dev Resources](#dev-resources) (4)
- [Library Analytics](#library-analytics) (6)
- [Activity Logs](#activity-logs) (1)
- [Developer Logs](#developer-logs) (1)
- [AI Usage](#ai-usage) (1)
- [Discovery](#discovery) (1, not in OpenAPI spec)
- [Payments](#payments) (1)
- [oEmbed](#oembed) (1)
- [OAuth token endpoints](#oauth-token-endpoints) (2)
- [SCIM (separate API)](#scim-separate-api)
- [Errors and rate limiting](#errors-and-rate-limiting)
- [Mutating vs read-only](#mutating-vs-read-only)
- [Gaps and undocumented areas](#gaps-and-undocumented-areas)

---

## Conventions

- **`file_key`** is parsed from any Figma file URL: `https://www.figma.com/file/{file_key}/{title}`. Node IDs come from `?node-id={id}`.
- Most file-scoped endpoints accept **either a file key or a branch key**. The exceptions — which require a *main* file key because branches cannot publish — are called out per endpoint: `GET /v1/files/:key/components`, `/component_sets`, `/styles`, `/variables/published`, and all Dev Resources endpoints.
- Many endpoints wrap their payload in a `{ status, error, meta }` envelope (`error: false` on success). Others return the payload at the top level. This is **inconsistent across the API** — the per-endpoint "Response" notes below say which. A gateway layer should normalize this.
- Auth headers: `X-Figma-Token: <token>` for personal and plan access tokens; `Authorization: Bearer <token>` for OAuth 2.

## Known spec defects

Each of these was re-verified against OpenAPI **v0.41.0** on 2026-08-11 rather than taken from the issue title — one reported defect (`linkAccess`) no longer reproduces despite its issue still being open.

| Defect | Status in v0.41.0 | Impact | What to do |
| --- | --- | --- | --- |
| **Integer params typed `number`** ([#86](https://github.com/figma/rest-api-spec/issues/86)) | **Still present, and broader than reported** | Generators emit float types, serialize `30` as `30.0`, and Figma returns `400 "'page_size' must be a valid number, received type String"` | Coerce to integer at the client boundary |
| **`GetFileNodesResponse` missing `err`** ([#81](https://github.com/figma/rest-api-spec/issues/81)) | Still present | A spec-typed client discards a field the API returns | Add `err` manually |
| **`err` typed as always-`null` on `GET images`** | Still present | On a `400`, `err` carries the diagnostic naming the invalid parameter — the most useful error detail the API gives | Type as `string \| null`; surface it in the 400 handler |
| **Analytics param named `file_key` vs docs' `library_file_key`** ([#28](https://github.com/figma/rest-api-spec/issues/28)) | Still present | Cosmetic on the wire (path segment); affects generated naming only | Pick one deliberately |
| **`GetFileResponse` missing `linkAccess`** ([#30](https://github.com/figma/rest-api-spec/issues/30)) | **Fixed** — present in v0.41.0, issue still open | none | Ignore the issue |
| **`GetProjectFilesResponse` has no field for `branch_data`** | Still present in v0.41.0 | The query parameter `branch_data` is declared and documented as returning "branch metadata in the response for each main file with a branch inside the project" ([get project files](https://developers.figma.com/docs/rest-api/#get-project-files)), but no response property carries it, and the prose does not spell the entries out either | Keep the extra field unnamed rather than inventing its shape; it survives into `--json` output regardless |

The 15 parameters affected by the `number`/`integer` defect, across 6 endpoints:

| Endpoint | Params typed `number` |
| --- | --- |
| `GET /v1/files/{file_key}` | `depth` |
| `GET /v1/files/{file_key}/nodes` | `depth` |
| `GET /v1/files/{file_key}/versions` | `page_size`, `before`, `after` |
| `GET /v1/teams/{team_id}/components` | `page_size`, `before`, `after` |
| `GET /v1/teams/{team_id}/component_sets` | `page_size`, `before`, `after` |
| `GET /v1/teams/{team_id}/styles` | `page_size`, `before`, `after` |
| `GET /v1/activity_logs` | `start_time`, `end_time`, `limit` |

`scale` on `GET images` is also typed `number`, but legitimately so — it accepts fractional values 0.01–4.

Newer endpoints (`GET /v1/ai_usage/daily`, `GET /v1/oembed`) correctly use `integer`, so this is un-backfilled legacy rather than a house convention.

**The spec is also incomplete, not merely imprecise:** the entire Discovery endpoint is absent from it (see [Discovery](#discovery)). Absence cannot be detected by reading the spec, so other omissions may exist.

## Pagination models

Figma uses **four different pagination models**. This is the single biggest source of implementation drift, so it is worth encoding once in a shared module.

| Model | Endpoints | Request params | Response |
| --- | --- | --- | --- |
| **A. URL pagination** (`prev_page`/`next_page` are *full URLs* to call) | `GET file versions`, `GET comment reactions`, `GET /v2/webhooks` (only when `plan_api_id` is used) | `page_size`, `before`, `after` (versions); `cursor` (reactions, webhooks) | `pagination: { prev_page?: string (URL), next_page?: string (URL) }` |
| **B. Integer id-cursor** | `GET team components`, `GET team component_sets`, `GET team styles` | `page_size` (default 30; **max 1000** for team components), `before` / `after` (mutually exclusive; opaque internally-tracked integers, *not* real ids) | `meta.cursor: { before?: number, after?: number }` |
| **C. Opaque cursor + boolean** | all 6 Library Analytics endpoints | `cursor` | `{ rows, next_page: boolean, cursor?: string }` — `cursor` absent when `next_page` is false. Max **1000 rows/page**. |
| **D. Opaque cursor + a "more?" boolean** | `GET /v1/ai_usage/daily`, `POST /v1/developer_logs` | `cursor`, `limit` (in the body for developer logs) | AI usage: `{ rows, next_cursor: string, has_next_page: boolean }` — `next_cursor` is `""` when exhausted. Developer logs: `meta: { items, cursor: string\|null, has_more: boolean }` — `null` when exhausted. **Same model, three different field names.** |

**Endpoints that do NOT paginate at all** (they return the complete set in one response — a real scaling hazard on large files/teams):

`GET file`, `GET file nodes`, `GET images`, `GET image fills`, `GET file meta`, `GET team projects`, `GET project meta`, `GET project files`, `GET file comments`, `GET /v1/me`, `GET file components`, `GET file component_sets`, `GET file styles`, `GET component/component_set/style by key`, `GET /v2/webhooks` *without* `plan_api_id`, `GET /v2/teams/:id/webhooks`, `GET webhook requests`, all Variables endpoints, all Dev Resources endpoints, `GET /v1/payments`, `GET /v1/oembed`.

`GET /v1/activity_logs` is a special case: it has **`limit` (default 1000) but no cursor**. To walk more than `limit` events you re-query with a shifted `start_time`/`end_time` window and `order`. Figma does not document a cursor for it.

---

## Files

Tag: `Files`. All read-only.

### `GET /v1/files/{file_key}` — Get file JSON

`operationId: getFile`. Returns the whole document tree.

| Param | In | Req | Notes |
| --- | --- | --- | --- |
| `file_key` | path | ✅ | File key or branch key |
| `version` | query | | Specific version ID; omit for current |
| `ids` | query | | Comma-separated node IDs — returns only those nodes, their children, and everything between them and the root |
| `depth` | query | | Positive int. `1` = pages only, `2` = pages + top-level objects. Unset = full tree |
| `geometry` | query | | `"paths"` to export vector data |
| `plugin_data` | query | | Comma-separated plugin IDs and/or the string `"shared"`; populates `pluginData` / `sharedPluginData` |
| `branch_data` | query | | Boolean. Returns branch metadata; **this is how you obtain branch keys** |

**Response (top level, no envelope):** `name`, `role` (`owner|editor|viewer`), `lastModified` (ISO 8601 UTC), `editorType` (`figma|figjam`), `thumbnailUrl?`, `version` (increments on modification — usable as a cheap change check), `document` (a `DOCUMENT` node), `components` (map node ID → component metadata), `componentSets`, `styles`, `schemaVersion`, `linkAccess?`, `mainFileKey?` (present if this file is a component/component set), `branches?`.

**Pagination:** none. **Rate limit tier 1** (the most expensive tier). Large files commonly 400 or 500 on timeout — see [Errors](#errors-and-rate-limiting). Use `depth` and `ids` aggressively.

### `GET /v1/files/{file_key}/nodes` — Get file JSON for specific nodes

`operationId: getFileNodes`. Params: `file_key` (path, ✅), **`ids` (query, ✅ — comma-separated node IDs)**, `version`, `depth`, `geometry`, `plugin_data`.

**Response:** `name`, `role`, `lastModified`, `editorType`, `thumbnailUrl`, `version`, `nodes` (map node ID → `{ document, components, componentSets, schemaVersion, styles }`), **and `err`** — which the prose docs document but the spec omits ([#81](https://github.com/figma/rest-api-spec/issues/81)); add it by hand. Note `linkAccess` values documented here: `inherit` (default for team-project files), `view`, `edit`, `org_view`, `org_edit`.

**Pagination:** none. **Rate limit tier 1.**

### `GET /v1/images/{file_key}` — Render images of file nodes

`operationId: getImages`. This is a *render* call, not a download of stored assets.

| Param | In | Req | Notes |
| --- | --- | --- | --- |
| `file_key` | path | ✅ | |
| `ids` | query | ✅ | Comma-separated node IDs to render |
| `version` | query | | |
| `scale` | query | | Number **0.01–4** |
| `format` | query | | `jpg` \| `png` \| `svg` \| `pdf` |
| `svg_outline_text` | query | | Render text as vector paths vs `<text>` elements |
| `svg_include_id` | query | | Adds layer name to `id` attribute |
| `svg_include_node_id` | query | | Adds node id to `data-node-id` attribute |
| `svg_simplify_stroke` | query | | Use stroke attributes instead of `<mask>` where possible |
| `contents_only` | query | | Exclude overlapping content (false is slower) |
| `use_absolute_bounds` | query | | Full node dimensions ignoring crop — use to export text without cropping |

**Response:** `{ err: string | null, images: { [nodeId]: string | null }, status: number }`. **`null` values in `images` are normal** — they mean *that node* failed to render (bad id, nothing renderable), not that the request failed. Every requested node ID is guaranteed to appear as a key regardless, so a `null` must not be retried as an error.

⚠️ The spec types `err` as always-`null`; the prose docs contradict it — on a `400`, **`err` names which parameter was invalid**. Type it `string | null` and surface it, or you throw away the API's best error detail.

**Constraints:** rendered image URLs **expire after 30 days**. Images up to **32 megapixels**; larger are scaled down. **Rate limit tier 1.** Batch node IDs into one call — Figma explicitly calls this out as the way to avoid rate limits.

### `GET /v1/files/{file_key}/images` — Get image fills

`operationId: getImageFills`. Returns download links for every user-supplied image used as a fill in the document. Only param is `file_key` (path).

**Response:** `{ error: false, status, meta: { images: { [imageRef]: string } } }`. The `imageRef` keys correspond to `imageRef` on `Paint` objects in the `GET file` output.

**Constraints:** these URLs **expire after no more than 14 days** (note: shorter than the 30-day render URLs). **Rate limit tier 2.** No pagination.

### `GET /v1/files/{file_key}/meta` — Get file metadata

`operationId: getFileMeta`. Cheap alternative to `GET file` when you only need metadata. Only param is `file_key`.

**Response:** `{ file: { name, folder_name (the containing project), last_touched_at (ISO 8601), creator: User, last_touched_by: User, thumbnail_url, editorType, role, link_access, url, ... } }`.

Note that `editorType` here has a **wider enum than `GET file`**: `figma | figjam | slides | buzz | sites | make`, versus just `figma | figjam` on `GET file`. Don't share one type between them.

**Rate limit tier 3** (the cheapest tier) versus tier 1 for `GET file` — so prefer this for any listing or inspection flow.

### `GET /v1/files/{file_key}/versions` — Get versions of a file

`operationId: getFileVersions`. Tagged `Files` in the spec; documented under "Version history".

Params: `file_key` (path ✅), `page_size` (default **30**), `before` (version ID; gets versions before it), `after` (version ID; gets versions after it).

**Response:** `{ versions: Version[], pagination: { prev_page?: URL, next_page?: URL } }`. `Version` = `{ id, created_at (ISO 8601), label: string|null, description: string|null, user: User, thumbnail_url? }`.

**Pagination:** model A. Per the param docs: if the response is not paginated, `before` returns the same data and `after`'s link is simply not included. **Rate limit tier 2.**

---

## Projects

Tag: `Projects`. All read-only.

### `GET /v1/teams/{team_id}/projects` — Get projects in a team

`operationId: getTeamProjects`. Param: `team_id` (path ✅). Response: `{ name, projects: [{ id, name }] }`.

⚠️ **There is no endpoint to discover a team ID from a token.** Figma's docs are explicit: "it is not currently possible to programmatically obtain the team id of a user just from a token." The user must read it from the team page URL (the segment after `/team/`). This means `cyber-figma` needs a `FIGMA_TEAM_ID`-style config value, exactly as `cyber-asana` needs `ASANA_WORKSPACE_GID`. Returns only projects visible to the authenticated user. **Tier 2.** No pagination.

### `GET /v1/projects/{project_id}/meta` — Get project metadata

`operationId: getProjectMeta`. Response: `{ id, name, thumbnail_url: string|null, file_count: integer, updated_at, created_at }`. **Tier 3.** No pagination.

### `GET /v1/projects/{project_id}/files` — Get files in a project

`operationId: getProjectFiles`. Params: `project_id` (path ✅), `branch_data` (query, boolean — include branch metadata per main file). Response: `{ name, files: [...] }`. **Tier 2.** No pagination.

Each entry of `files` is `{ key, name, thumbnail_url?, last_modified }`. What `branch_data=true` adds per main file is not in the response type — see **Known spec defects**.

---

## Comments

Tag: `Comments`. 1 read, 2 mutating.

### `GET /v1/files/{file_key}/comments` — Get comments in a file

`operationId: getComments`. Params: `file_key` (path ✅), `as_md` (query, boolean — return comment bodies as markdown where applicable). Response: `{ comments: Comment[] }`. **No pagination** — the whole comment list comes back at once. **Tier 2.**

### `POST /v1/files/{file_key}/comments` — Add a comment ✏️

`operationId: postComment`. Body (`application/json`, required): `message` (✅), `comment_id` (reply target — **must be a root comment; you cannot reply to a reply**), `client_meta` (oneOf: a canvas `Vector` position, or a `FrameOffset`, `Region`, `FrameOffsetRegion` — i.e. where to pin the comment).

Response: the created `Comment` — `{ id, client_meta, file_key, parent_id?, user, created_at, resolved_at: string|null, message, order_id: string|null (only set for top-level comments; the number shown in the UI), reactions: [] }`.

Requires `file_comments:write`. **Not usable with a plan access token.**

### `DELETE /v1/files/{file_key}/comments/{comment_id}` — Delete a comment ✏️

`operationId: deleteComment`. **Only the author of a comment may delete it.** Response: `{ status, error: false }`.

---

## Comment Reactions

Tag: `Comment Reactions`. 1 read, 2 mutating.

### `GET /v1/files/{file_key}/comments/{comment_id}/reactions`

`operationId: getCommentReactions`. Params: `file_key`, `comment_id` (path ✅), `cursor` (query). Response: `{ reactions: Reaction[], pagination: { prev_page?, next_page? } }`. **Paginated (model A)** — one of the few genuinely paginated read endpoints.

### `POST /v1/files/{file_key}/comments/{comment_id}/reactions` ✏️

`operationId: postCommentReaction`. Body: `emoji` (✅) — an **emoji shortcode**, e.g. `:heart:`, `:+1::skin-tone-2:`. The accepted shortcode list is published as a file linked from the spec/docs (not enumerated in the OpenAPI schema). Response: `{ status, error: false }`.

### `DELETE /v1/files/{file_key}/comments/{comment_id}/reactions` ✏️

`operationId: deleteCommentReaction`. **`emoji` is a required *query* parameter**, not a path segment. Only the person who made the reaction may delete it. Response: `{ status, error: false }`.

---

## Users

### `GET /v1/me` — Get current user

`operationId: getMe`. No params. Response: `{ id, handle, img_url, email }` — the `email` field is **only** present on this endpoint.

**Tier 3.** ⚠️ Cannot be called with a plan access token (plan tokens are not tied to a user). Scope: `current_user:read`. This is the natural "verify my credentials" command for the CLI, but note it will not work for plan-token users — a connection check must fall back to something else (e.g. `GET file meta` on a known file) in that mode.

---

## Components, Component Sets, Styles

Three parallel families with identical shapes. Tags: `Components`, `Component Sets`, `Styles`. All read-only, all **rate limit tier 3**.

| Resource | Team-scoped (paginated) | File-scoped (not paginated) | By key |
| --- | --- | --- | --- |
| Components | `GET /v1/teams/{team_id}/components` | `GET /v1/files/{file_key}/components` | `GET /v1/components/{key}` |
| Component Sets | `GET /v1/teams/{team_id}/component_sets` | `GET /v1/files/{file_key}/component_sets` | `GET /v1/component_sets/{key}` |
| Styles | `GET /v1/teams/{team_id}/styles` | `GET /v1/files/{file_key}/styles` | `GET /v1/styles/{key}` |

**All of these return only *published* library content**, not every component in a file.

- **Team-scoped** params: `team_id` (path ✅), `page_size` (default **30**; components explicitly documents **max 1000** since 2025-07-07 — values above are capped), `after` / `before` (mutually exclusive integer cursors, opaque). Response: `{ status, error, meta: { components|component_sets|styles: [...], cursor: { before?, after? } } }`. **Pagination model B.**
- **File-scoped** params: `file_key` (path ✅) — **must be a main file key, not a branch key**, since branches cannot publish. Response: `{ status, error, meta: { components|component_sets|styles: [...] } }`. **No pagination.**
- **By key** params: `key` (path ✅). Response: `{ status, error, meta: <single object> }`.

Scopes differ per scope of access: `team_library_content:read` (team), `library_content:read` (file), `library_assets:read` (by key).

---

## Webhooks v2

Tag: `Webhooks`. **Note the `/v2/` prefix** — this is the only family not on `/v1/`. 4 read, 3 mutating.

**Event types:** `PING`, `FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_DELETE`, `LIBRARY_PUBLISH`, `FILE_COMMENT`, `DEV_MODE_STATUS_UPDATE`.
**Statuses:** `ACTIVE`, `PAUSED`.
**Contexts:** `team`, `project`, `file` (responses report them uppercased: `TEAM`, `PROJECT`, `FILE`).

### `GET /v2/webhooks` — Get webhooks by context or plan

`operationId: getWebhooks`. Params: `context` (`team|project|file`), `context_id`, `plan_api_id`, `cursor`.

- `context` + `context_id` → webhooks on that context. **Not paginated**; `cursor` is ignored.
- `plan_api_id` → every webhook across all contexts you can access on the plan. **Paginated (model A)**. Mutually exclusive with `context_id`.
- **Constructing `plan_api_id`:** `team-<teamId>` on Professional, `organization-<orgId>` on Organization/Enterprise/Government. The team id follows `/team/` in a Figma URL; the org id follows `/files/`.

Response: `{ webhooks: [...], pagination? }`.

### `POST /v2/webhooks` — Create a webhook ✏️

`operationId: postWebhook`. Body (required): `event_type` ✅, `context` ✅, `context_id` ✅, `endpoint` ✅ (max **2048** chars), `passcode` ✅ (max **100** chars — echoed back to your endpoint so you can verify the caller is Figma), `status` (`ACTIVE|PAUSED`), `description` (max **150** chars), `team_id` (**deprecated**, use `context`/`context_id`).

A `PING` event fires immediately on creation unless you create it `PAUSED`.

### `GET /v2/webhooks/{webhook_id}` / `PUT` ✏️ / `DELETE` ✏️

`getWebhook` / `putWebhook` / `deleteWebhook`. The `PUT` body requires `event_type`, `endpoint`, `passcode`, with optional `status` and `description` — note it does **not** accept `context`/`context_id`, so a webhook cannot be re-targeted. `DELETE` "cannot be reversed" and returns the deleted webhook object.

Webhook objects: `{ id, event_type, team_id (deprecated), context, context_id, plan_api_id, status, client_id: string|null (the OAuth app that registered it), passcode (**always empty string on GET responses**), endpoint, description: string|null }`.

**`description` length, spec vs spec:** OpenAPI v0.41.0 contradicts itself — the `POST` and `PUT` request bodies say `description` has a "Max length 150 characters", while the `WebhookV2` response schema says 140 ([openapi.yaml](https://github.com/figma/rest-api-spec/blob/main/openapi/openapi.yaml), `postWebhook` requestBody vs `components.schemas.WebhookV2`). Neither number is safe to enforce client-side; let Figma answer for it.

### `GET /v2/teams/{team_id}/webhooks` — **[Deprecated]**

`operationId: getTeamWebhooks`. Marked deprecated in the spec summary; superseded by `GET /v2/webhooks?context=team&context_id=…`. Response: `{ webhooks: [...] }`. Do not surface this in new tooling except as a compatibility shim.

### `GET /v2/webhooks/{webhook_id}/requests` — Get webhook requests

`operationId: getWebhookRequests`. Returns all webhook requests **sent within the last week** — the debugging endpoint. Response: `{ requests: [{ webhook_id, request_info, response_info, error_msg: string|null }] }`. No pagination.

**Delivery semantics (from the Webhooks guide, not the spec):** your endpoint must return `200 OK` promptly; anything else (or a timeout) counts as an error. Figma retries failed requests **3 times with exponential backoff — at 5 minutes, 30 minutes, and 3 hours**. Figma does *not* auto-deactivate endpoints that fail persistently. Every payload except `PING` includes the file name and file key.

**Who can create webhooks:** team context → team admins; project context → anyone with Can edit on the project; file context → anyone with Can edit on the file.

**Count limits:** 20 webhooks per team, 5 per project, 3 per file. Total *file* webhooks per plan: Professional 150, Organization 300, Enterprise 600.

**Team-context caveat:** team webhooks fire for files available to everyone on the team or in view-only projects; they do **not** fire for files in invite-only projects.

There is no UI for webhooks — the API is the only management surface.

---

## Variables

Tag: `Variables`. 2 read, 1 mutating. **Enterprise-only** — see the plans doc.

### `GET /v1/files/{file_key}/variables/local` — Get local variables

`operationId: getLocalVariables`. Param: `file_key` (file or branch key). Response: `{ status, error, meta: { variables, variableCollections } }`.

Enumerates variables created in the file *and* remote variables used in it (remote ones are referenced by `subscribed_id`). Nodes in `GET file` carry a `boundVariables` property containing `variableId`; this endpoint is how you resolve those to full objects. **This is also the only place to read mode values** — the published endpoint omits modes.

### `GET /v1/files/{file_key}/variables/published` — Get published variables

`operationId: getPublishedVariables`. Param: `file_key` — **must be a main file key**, not a branch.

Differences from `local`: every variable and collection carries a `subscribed_id`, and **modes are omitted**. Published variables have two ids — `id` (stable, assigned in the creating file) and `subscribed_id` (**changes every time the variable is modified and republished**). `key` is also stable. `updatedAt` is an ISO 8601 timestamp of the last *publish*.

### `POST /v1/files/{file_key}/variables` — Create/modify/delete variables ✏️

`operationId: postVariables`. Bulk mutation endpoint. Body arrays, **applied in this order**, and within each array in array order:

1. `variableCollections` — create/update/delete collections
2. `variableModes` — create/update/delete modes within collections (**max 40 modes per collection; mode names ≤ 40 chars**)
3. `variables` — create/update/delete variables (**max 5000 variables per collection**; names must be unique within a collection and cannot contain characters such as `.{}`)
4. `variableModeValues` — set a value for a (variable, mode) pair

Response: `{ status, error, meta: { tempIdToRealId } }` — temporary ids you supply are mapped to real ids.

⚠️ **Variables changed via REST must be published before other files see them.** Publishing is *not* exposed by the REST API (see [Gaps](#gaps-and-undocumented-areas)).

Also relevant: *extended collections* (added 2025-11-18) — `parentVariableCollectionId`, `isExtension`, `variableOverrides`, `initialModeIdToParentModeIdMapping`, and an extended mode-ID format like `VariableCollectionId:2:5/1:0` that distinguishes updating a root value from creating an override. Setting an override to `null` removes it and falls back to the parent value.

**Rate limit note:** `GET local/published` are tier 2 but **`POST variables` is tier 3** — the *cheaper* tier, unusually.

---

## Dev Resources

Tag: `Dev Resources`. 1 read, 3 mutating. Dev resources are developer-contributed URLs attached to nodes, surfaced in **Dev Mode**.

Unlike variables/components/styles, **dev resources do not need to be published** — they are live immediately, including on already-published components.

### `GET /v1/files/{file_key}/dev_resources`

`operationId: getDevResources`. Params: `file_key` (path ✅ — **main file key, not a branch**), `node_ids` (query, comma-separated; omit for all in the file). Response: `{ dev_resources: DevResource[] }` where `DevResource = { id, name, url, file_key, node_id }`. No pagination.

### `POST /v1/dev_resources` — Bulk create ✏️

`operationId: postDevResources`. Note the path is **file-agnostic** — it creates across multiple files in one call. Body: `dev_resources: [{ name, url, file_key, node_id }]` (✅).

**Partial-success semantics:** you can get a `200` even when some resources fail. Response is `{ links_created: [...], errors?: [...] }`. Documented failure causes: `file_key` not found; the node already has the **maximum of 10 dev resources**; another dev resource on the node has the same URL. A client must inspect `errors` — a 2xx is not proof of success.

### `PUT /v1/dev_resources` — Bulk update ✏️

`operationId: putDevResources`. Same partial-success model: `{ links_updated?: [...], errors?: [...] }`.

### `DELETE /v1/files/{file_key}/dev_resources/{dev_resource_id}` ✏️

`operationId: deleteDevResource`. **No 2xx response body is defined in the spec** — treat it as 204/empty.

---

## Library Analytics

Tag: `Library Analytics`. 6 read-only endpoints, all `GET /v1/analytics/libraries/{file_key}/…`. **Enterprise-only**; scope `library_analytics:read`.

| Path suffix | `group_by` (required) | `start_date`/`end_date`? |
| --- | --- | --- |
| `/component/actions` | `component` \| `team` | ✅ |
| `/component/usages` | `component` \| `file` | ❌ |
| `/style/actions` | `style` \| `team` | ✅ |
| `/style/usages` | `style` \| `file` | ❌ |
| `/variable/actions` | `variable` \| `team` | ✅ |
| `/variable/usages` | `variable` \| `file` | ❌ |

**Key asymmetry:** `…/actions` endpoints are **time series** and accept `start_date` / `end_date` (`YYYY-MM-DD`; start rounds *back* to the start of a week, end rounds *forward* to the end of a week; default range is the prior year to the latest computed week). `…/usages` endpoints are a **snapshot/census** and accept no date range at all.

Common params: `file_key` (path ✅ — the *library* file), `cursor` (query), `group_by` (query ✅).

Response: `{ rows: [...], next_page: boolean, cursor?: string }` — **pagination model C, max 1000 rows per page**; `cursor` is omitted when `next_page` is false.

**Semantics worth encoding in the tool:**
- Data is **recalculated daily at 00:00 UTC** — there is no point polling more often.
- Responses honor the requesting user's permissions, but rather than dropping inaccessible rows, Figma **obfuscates the names**: rows appear as `Team not visible` / `File not visible`. Any aggregation must not treat these as a single real entity.
- Component usages/insertions/detachments **outside your org are excluded entirely**.

---

## Activity Logs

### `GET /v1/activity_logs`

`operationId: getActivityLogs`. **Enterprise-only, org admins only.** Auth: `OrgOAuth2` with scope `org:activity_log_read`, **or** a plan access token. Notably the spec does **not** list `PersonalAccessToken` for this endpoint.

| Param | Notes |
| --- | --- |
| `events` | Comma-separated event types; all by default |
| `start_time` | Unix timestamp of least recent event; **defaults to one year ago** |
| `end_time` | Unix timestamp of most recent; defaults to now |
| `limit` | **Defaults to 1000** |
| `order` | `asc` (default) \| `desc` |

Response: `{ status, error, meta: { activity_logs: ActivityLog[] (ascending by timestamp by default), cursor: string ("encodes the last event"), next_page: boolean } }`.

⚠️ **Asymmetric pagination:** the response advertises a `cursor` and `next_page`, but **no `cursor` request parameter is documented** — there is nothing to pass it back to. Until that is clarified, page by shifting the `start_time`/`end_time` window (and use `order`), and treat the returned `cursor` as unusable.

`ActivityLog = { id, timestamp (Unix seconds), actor: { type: "user", id, name, email } | null, action: { type, details }, entity, ... }`. Actor `name` is `"SCIM Provider"` for SCIM-driven events and `"Figma Support"` for official support actions.

Intended for SIEM integration. Figma states this API "can only be used by Figma Enterprise organizations building internal applications." **Tier 3.**

---

## Developer Logs

### `POST /v1/developer_logs`

`operationId: getDeveloperLogs` — note it is a **`POST` that reads**; filters go in the body, not the query string. It is not a mutation.

**Enterprise + Governance+ add-on, org admins only. Plan access token only** (the spec lists no other security scheme), scope `org:developer_log_read`.

Body (all optional): `token_type` (`plan_access_token|developer_token|oauth_token`), `token`, `token_name`, `user_email`, `ip_address` (all accept comma-separated prefixes), `event_source` (`rest_api|mcp_server`), `date_range` (`last_24h|last_7d|last_30d`), `limit`, `cursor`.

Response: `{ status, error, meta: { items: DeveloperLog[] (descending by timestamp), cursor: string|null (`null` when exhausted), has_more: boolean } }` — cursor paging, but note the field names differ again from AI Usage's `next_cursor`/`has_next_page`. **Records are retained 30 days only** — both the REST endpoint and the UI at `figma.com/developers/log` are capped at that window. Logs cover both REST API and **MCP server** requests. **Tier 3.**

---

## AI Usage

### `GET /v1/ai_usage/daily`

`operationId: getAiUsageDaily`. Added **2026-06-12**. **Enterprise-only, org admins; plan access token only**, scope `org:ai_metering_usage_read`.

| Param | Req | Notes |
| --- | --- | --- |
| `start_date` | ✅ | `YYYY-MM-DD` UTC, inclusive. **Must be on or after `2025-12-01`** and ≤ 366 days before today |
| `end_date` | ✅ | `YYYY-MM-DD` UTC, inclusive; ≥ `start_date`, ≤ today |
| `user_email` | | Restrict to one user. **An email matching no Figma user returns 400**, not an empty list |
| `limit` | | Default **1000**, max **1000** |
| `cursor` | | Opaque |

Response: `{ rows, next_cursor: string, has_next_page: boolean }`. Rows are per-user, per-day credit aggregates ordered by `day`, then user, then `editor_type`, attributed to a workspace/team/license group. **Data lags real time by up to 5–6 hours**, so current-day figures are unreliable.

---

## Discovery

### `GET /v1/discovery` — Get text events

⚠️ **Not present in the OpenAPI spec** — documented only at <https://developers.figma.com/docs/rest-api/discovery-endpoints/>. Any generated client will be missing it.

**Enterprise with Governance+ only, org admins only.** OAuth 2 with scope `org:discovery_read`.

| Query param | Req | Notes |
| --- | --- | --- |
| `start_date` | ✅ | ISO 8601 UTC, e.g. `2025-01-01T00:00:00Z`. Must be before `end_date` and **at least 1 hour in the past** |
| `end_date` | | Defaults to one hour after `start_date`. **Cannot be more than 24 hours after `start_date`** |
| `file_ttl_in_seconds` | | Validity of the returned download links. Default **86400** (1 day); must be an integer between **60 and 86400** |

Response: `{ error: Boolean, status: Number, meta: { urls: Record<String, Array<String>> }, i18n: String|null, message?: String|null }`. The `urls` map is keyed by hour (`"2024/01/01/00"`) and points at **S3 download links for JSON files — one file per requested hour**. This is a two-stage API: the endpoint returns links, and you then fetch the JSON blobs. Links can be regenerated for the same window repeatedly; the URLs change but the content does not.

Data covered: in-file text (Design, FigJam incl. sticky notes and tables, Buzz, Sites, Slides), cursor chat, file comments and reactions, component documentation descriptions/links, Dev Mode annotations and dev resources, and **AI prompts** (added 2026-01-21).

**Error codes** differ from the rest of the API — notably `429` is documented as "more than 20 per second", and both `401` and `403` are described as "The OAuth token is invalid." Rate-limit tier 2.

---

## Payments

### `GET /v1/payments`

`operationId: getPayments`. Validates purchases of a plugin, widget, or Community file from a server.

**Personal access token only — the docs state plainly that the Payments REST API does not support OAuth 2**, and the spec lists no plan-token support either.

Two usage modes:
1. `plugin_payment_token` — a short-lived token from `getPluginPaymentTokenAsync` in the Plugin Payments API; used from plugin/widget code.
2. `user_id` + exactly one of `community_file_id` / `plugin_id` / `widget_id` — used from anywhere else. You get `user_id` by having the user OAuth to the REST API.

Response: `{ status, error, meta: {...} }` describing the user's payment state. **You can only query resources you own.** Plugin payment tokens are *not* a substitute for a personal access token. **Tier 3.**

---

## oEmbed

### `GET /v1/oembed`

`operationId: getOEmbed`. Added **2026-03-25**. Follows the [oEmbed 1.0 spec](https://oembed.com/). Params: `url` (✅ — a Figma file or published Make site URL), `maxwidth` (default 800), `maxheight` (default 450); dimensions are adjusted to preserve 16:9.

Response: `{ version: "1.0", type: "rich", title, key?, url, provider_name ("Figma" or "Make"), provider_url, cache_age (always 3600), width, height, html (an iframe embed), is_published_site?, folder_name?, thumbnail_url?, thumbnail_width?, thumbnail_height? }`. `key` is absent for published Makes.

Scope `file_metadata:read`. ⚠️ **Not usable with a plan access token.** Distinctively, this endpoint can return **`501 Not Implemented`** — no other endpoint in the spec does.

---

## OAuth token endpoints

Not in the OpenAPI spec, but part of the HTTP surface any client must implement.

| Method | URL | Notes |
| --- | --- | --- |
| `GET` | `https://www.figma.com/oauth` | Authorization page (browser only — **WebView is unsupported**). Params: `client_id`, `redirect_uri`, `scope` (space- or comma-separated), `state`, `response_type=code`, optional `code_challenge` (PKCE, **S256 only**) |
| `POST` | `https://api.figma.com/v1/oauth/token` | Exchange code. `Content-Type: application/x-www-form-urlencoded`, HTTP Basic auth with base64 `client_id:client_secret`. Body: `redirect_uri`, `code`, `grant_type=authorization_code`, `code_verifier` (if PKCE). Returns `{ user_id_string, access_token, token_type: "bearer", expires_in, refresh_token }` |
| `POST` | `https://api.figma.com/v1/oauth/refresh` | Same auth scheme. Body: `refresh_token`. Returns `{ access_token, token_type, expires_in }` — **no new refresh token** |

⚠️ **Authorization codes expire 30 seconds after issue.** ⚠️ The response's numeric `user_id` is **deprecated** — use `user_id_string`, because Figma user IDs look numeric but do not all fit in a JS number or a Go `float64`. ⚠️ Figma keeps **only one access token per (app, user)**: refreshing invalidates the previous access token immediately.

Government instance: `https://api.figma-gov.com/v1/oauth/token`.

---

## SCIM (separate API)

Figma's SCIM API is explicitly **"distinct from the Figma REST API"** — different base URL, different endpoints, different auth. It handles user lifecycle (create/update/delete accounts), **not authentication**.

- Base URL: `https://www.figma.com/scim/v2/:tenantid` — the Tenant ID comes from Admin Settings → Login and Provisioning → SAML SSO.
- Auth: `Authorization: Bearer <SCIM API token>`, generated at Admin Settings → SCIM Provisioning (shown once).
- Verbs: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`; JSON bodies with `Content-type: application/json`.
- **Not supported on Starter or Professional plans.**
- Dedicated IdP integrations: Microsoft Entra ID, Okta, OneLogin, Google SSO, AD FS; other IdPs can use the raw endpoints.

The individual SCIM resource endpoints (`/Users`, `/Groups`, …) are documented on the SCIM reference page and are **out of scope for a REST-API wrapper**; recommend `cyber-figma` does not attempt to cover SCIM.

---

## Errors and rate limiting

Standard error codes across the API (<https://developers.figma.com/docs/rest-api/errors/>):

| Code | Meaning and non-obvious causes |
| --- | --- |
| `400` | Invalid/malformed parameters — **also returned when the requested resources are too large and the request times out.** Reduce the number and size of objects requested |
| `401` | Token missing or incorrect (used by Variables, Dev Resources, Analytics, Activity/Developer Logs, AI Usage, Payments; notably **not** declared on the Files endpoints) |
| `403` | Valid request, refused — insufficient permissions, **or making an HTTP request instead of HTTPS**. The file-endpoints reference gives a third cause the global page omits: **"the developer / OAuth token is invalid or expired."** So **token expiry presents as 403, not 401** — do not map 403 to "permission denied" alone |
| `404` | File or resource not found |
| `429` | Rate limited. See below |
| `500` | Internal error — "most commonly occurs for very large image render requests" |
| `501` | oEmbed only |

**429 response fields:** `Retry-After` (integer seconds), `X-Figma-Plan-Tier` (`enterprise|org|pro|starter|student`), `X-Figma-Rate-Limit-Type` (`low` for Collab/Viewer seats, `high` for Full/Dev), `X-Figma-Upgrade-Link` (a `/pricing` or `/settings` URL to surface to the user).

Figma uses a **leaky bucket** algorithm. Full tier/seat/plan quota table is in [`figma-plans-and-limits.md`](./figma-plans-and-limits.md). Figma's own mitigation guidance: batch requests (one `GET images` call with many node IDs rather than many calls), cache results, and honor `Retry-After` with backoff.

---

## Mutating vs read-only

**Mutating (11):**

| Operation | Endpoint |
| --- | --- |
| Create comment | `POST /v1/files/{file_key}/comments` |
| Delete comment | `DELETE /v1/files/{file_key}/comments/{comment_id}` |
| Add reaction | `POST /v1/files/{file_key}/comments/{comment_id}/reactions` |
| Delete reaction | `DELETE /v1/files/{file_key}/comments/{comment_id}/reactions` |
| Create webhook | `POST /v2/webhooks` |
| Update webhook | `PUT /v2/webhooks/{webhook_id}` |
| Delete webhook | `DELETE /v2/webhooks/{webhook_id}` |
| Bulk variables write | `POST /v1/files/{file_key}/variables` |
| Create dev resources | `POST /v1/dev_resources` |
| Update dev resources | `PUT /v1/dev_resources` |
| Delete dev resource | `DELETE /v1/files/{file_key}/dev_resources/{dev_resource_id}` |

**Read-only:** the other 39 spec operations, plus Discovery. Two of them look like mutations but are not:

- `POST /v1/developer_logs` — a read with a JSON filter body.
- `POST /v1/oauth/token` and `/refresh` — auth, not resource mutation.

Nothing in the REST API creates or deletes **files, projects, teams, pages, or nodes**. The write surface is deliberately narrow: comments, reactions, webhooks, variables, dev resources. Any "edit the design" capability lives in the Plugin API, not here.

---

## Gaps and undocumented areas

Stated as gaps rather than guesses.

- **No file/project/team creation or deletion.** No node editing. Not exposed by the REST API at all.
- **No publish endpoint.** Variables written via `POST variables` must be published before other files see them, but publishing is not a REST operation — **undocumented as an API**; it is a UI/plugin action.
- **No team-ID discovery.** Explicitly acknowledged by Figma; the ID must be read out of a URL.
- **`selections:read`** is a documented OAuth scope ("Read most recent selection in files you can access") but **no endpoint in the OpenAPI spec or the docs consumes it.** Its endpoint is undocumented.
- **`file_code_connect:write`** is referenced by the plan-access-tokens page as a scope that plan tokens cannot use, but it is **absent from the published scopes table** and no endpoint in the spec requires it. Code Connect is driven by the Figma CLI rather than documented REST endpoints.
- **Discovery is absent from the OpenAPI spec** (see above) — generated clients will not have it.
- **Activity Logs cursor pagination** — the response returns `cursor` and `next_page`, but there is **no documented `cursor` request parameter to pass it back to**. How to consume it is undocumented; window by time instead.
- **Comment shortcode list** — the accepted emoji shortcodes are in an external file linked from the docs, not enumerated in any schema.
- **PAT count limits and rotation** — the number of personal access tokens allowed per account is **undocumented**, and there is no PAT auto-rotation (only plan access tokens support refresh).
- **Rate limits are explicitly changeable**: "Figma reserves the right to change rate limits. Changes may affect specific endpoints, tiers, or plans." Do not hard-code quotas as invariants.

# Evidence

Evidence for the `figma-rest-api-surface` topic. Entries are in ascending claim-ID order; new entries append at the end.

Verification convention: where an entry reports a third-party claim (e.g. a GitHub issue), "Verified" records whether that claim was independently reproduced against the pinned spec snapshot (OpenAPI v0.41.0, retrieved 2026-08-11) rather than trusted from its title.

## Claim E01

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OpenAPI specification v0.41.0, `openapi/openapi.yaml`
- URL: https://github.com/figma/rest-api-spec
- Type: official machine-readable specification (primary)

Notes:
- The REST API comprises exactly **50 operations** in the spec, across 16 tags: Files (6, incl. versions), Projects (3), Comments (3), Comment Reactions (3), Users (1), Components (3), Component Sets (3), Styles (3), Webhooks (7), Activity Logs (1), Developer Logs (1), AI Usage (1), Payments (1), Variables (3), Dev Resources (4), Library Analytics (6), oEmbed (1).
- Count obtained by programmatically enumerating `paths` × methods, not by reading prose — removes miscounting risk.
- This is the backbone of the inventory; every endpoint's parameters and response shape were extracted from this file.

## Claim E02

Date: 2026-08-11
Status: mixed
Confidence: high

Source:
- Label: Figma OpenAPI specification, `info.description`
- URL: https://github.com/figma/rest-api-spec
- Type: official machine-readable specification (primary)

Notes:
- Figma self-describes the spec as **beta**: released "as a beta given the large surface area and complexity of the REST API. If you notice any inaccuracies with the specification, please file an issue."
- This is a first-party warning that the most authoritative-looking source is known-imperfect. It is the reason the issue tracker was opened as a corrective source angle.
- Weakens any conclusion that relies on the spec alone; motivates E03–E07.

## Claim E03

Date: 2026-08-11
Status: contradicts
Confidence: high

Source:
- Label: `figma/rest-api-spec` issue #86 — "Incorrect type for page_size, before, after parameters in /v1/files/{file_key}/versions"
- URL: https://github.com/figma/rest-api-spec/issues/86
- Type: issue thread (independent practitioner report), cross-verified against the spec

Notes:
- Reported defect: numeric query params typed `type: number` where they are semantically integers. Generators (the reporter used swift-openapi-generator) emit Double/Float, serialize `30` as `30.0`, and Figma returns **400**: `"'page_size' must be a valid number, received type String"`.
- **Verified: still reproduces in v0.41.0, and is broader than reported.** Enumerating all numeric params found **15 affected across 6 endpoints**: `depth` (GET file, GET file nodes), `scale` (GET images), `page_size`/`before`/`after` (GET file versions; GET team components; GET team component_sets; GET team styles), `start_time`/`end_time`/`limit` (GET activity_logs).
- Counter-signal within the same data: `ai_usage.limit`, `oembed.maxwidth`, `oembed.maxheight` **are** correctly typed `integer` — newer endpoints got it right, so this is un-backfilled legacy rather than a deliberate convention.
- Note `scale` and `depth` are genuinely fractional/integral respectively; `scale` (0.01–4) is legitimately `number`. The defect applies to the integral ones.
- Actionable: coerce integer params at the client boundary; do not ship a naively generated client.

## Claim E04

Date: 2026-08-11
Status: contradicts
Confidence: high

Source:
- Label: `figma/rest-api-spec` issue #81 — "GetFileNodesResponse doesn't have an err property on it"
- URL: https://github.com/figma/rest-api-spec/issues/81
- Type: issue thread, cross-verified against the spec and the prose docs

Notes:
- **Verified: still reproduces in v0.41.0.** `GET /v1/files/{file_key}/nodes` 200 schema properties are exactly `[name, role, lastModified, editorType, thumbnailUrl, version, nodes]` — no `err`.
- The prose docs for the same endpoint **do** document `"err": String` in the return value, confirming the spec is the incorrect party.
- Consequence: a strictly spec-typed client discards a field the API actually returns.

## Claim E05

Date: 2026-08-11
Status: contradicts
Confidence: high

Source:
- Label: Figma file endpoints reference — return values and per-endpoint error tables
- URL: https://developers.figma.com/docs/rest-api/file-endpoints/
- Type: official documentation (prose)

Notes:
- The docs give `GET /v1/images/:key` a return value of `{ "err": String, "images": Map<String,String>, "status": Number }`, and its error table states: "**400** — Invalid parameter, the `err` property will indicate which parameter is invalid."
- The spec types the same field as `err: null` ("For successful requests, this value is always `null`"). Both are true but partial: `err` is `null` on success and a **diagnostic string** on 400.
- Correct client typing is `string | null`, and the 400 handler should surface `err` rather than a generic message.
- The same page also gives endpoint-level error semantics that differ from the global errors page — notably "403: The developer / OAuth token is invalid **or expired**", which the global page describes only as a permissions/HTTPS failure. Token expiry therefore presents as 403, not 401, on file endpoints.

## Claim E06

Date: 2026-08-11
Status: superseded
Confidence: high

Source:
- Label: `figma/rest-api-spec` issue #30 — "`GetFileResponse` does not have a `linkAccess` property"
- URL: https://github.com/figma/rest-api-spec/issues/30
- Type: issue thread, cross-verified against the spec

Notes:
- **Verified: no longer reproduces.** `linkAccess` **is** present in the `GET /v1/files/{file_key}` 200 schema in v0.41.0, despite the issue remaining open since 2024-11-14.
- Methodological finding: Figma fixes spec defects without closing the corresponding issues. Open-issue count is therefore an unreliable proxy for current defect count, and every reported defect must be re-verified against the pinned snapshot.
- This entry is retained (not deleted) as the record of why the verification step exists.

## Claim E07

Date: 2026-08-11
Status: mixed
Confidence: medium

Source:
- Label: `figma/rest-api-spec` issue #28 — "Analytics specs - `library_file_key` or `file_key`?"
- URL: https://github.com/figma/rest-api-spec/issues/28
- Type: issue thread, cross-verified against the spec

Notes:
- **Verified: still reproduces.** Spec path is `/v1/analytics/libraries/{file_key}/…`; the web documentation names the same path parameter `library_file_key`.
- Impact is **cosmetic on the wire** — a path segment's spec-level name never appears in the request — but it does change generated parameter/method signatures, and it is a naming decision `cyber-figma` must make deliberately.
- Confidence medium rather than high only because the docs page naming may have since been updated; the mismatch was confirmed from the spec side and the issue is unresolved.

## Claim E08

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OpenAPI specification v0.41.0 — parameters and 200 schemas across all list operations
- URL: https://github.com/figma/rest-api-spec
- Type: official machine-readable specification (primary)

Notes:
- Four mutually incompatible pagination models coexist:
  - **A. Full-URL** — `pagination: { prev_page, next_page }` where values are complete URLs to call. Used by file versions, comment reactions, and `GET /v2/webhooks` *only when* `plan_api_id` is supplied.
  - **B. Integer id-cursor** — `page_size` + mutually exclusive `before`/`after`, returning `meta.cursor: { before, after }`. Used by the three team-library list endpoints. Cursor values are "internally tracked integers that don't correspond to any Ids".
  - **C. Opaque cursor + boolean** — `{ rows, next_page: boolean, cursor? }`, cursor omitted when exhausted. All six Library Analytics endpoints; max 1000 rows/page.
  - **D. Opaque cursor + a "more?" boolean, with inconsistent field names** — AI Usage returns `next_cursor` (empty string when exhausted) + `has_next_page`; Developer Logs returns `cursor` (null when exhausted) + `has_more`. Same model, different names, different sentinel values.
- The majority of list endpoints paginate **not at all**, returning complete sets: file comments, team projects, project files, all file-scoped component/style lists, webhooks by context, webhook requests, all variables and dev-resources endpoints.
- Supports the architectural conclusion that pagination must be normalized once behind a single shape.

## Claim E09

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OpenAPI specification v0.41.0 — HTTP methods across all paths
- URL: https://github.com/figma/rest-api-spec
- Type: official machine-readable specification (primary)

Notes:
- **11 of 50 operations mutate**: create/delete comment, create/delete comment reaction, create/update/delete webhook, bulk variables write, create/update dev resources, delete dev resource.
- Nothing creates or deletes files, projects, teams, pages, or nodes. The REST API cannot edit designs; that is the Plugin API's role.
- Two false positives for method-based classification: `POST /v1/developer_logs` is a **read** whose filters travel in a JSON body, and the OAuth token/refresh endpoints are auth rather than resource mutation. Method alone is not a safe mutation test.

## Claim E10

Date: 2026-08-11
Status: contradicts
Confidence: high

Source:
- Label: Figma Discovery endpoints documentation
- URL: https://developers.figma.com/docs/rest-api/discovery-endpoints/
- Type: official documentation (prose)

Notes:
- `GET /v1/discovery` is fully documented — parameters (`start_date` required, `end_date`, `file_ttl_in_seconds` 60–86400), response shape, and its own error table — but **does not appear in the OpenAPI spec at all**.
- Confirms the spec is incomplete as an inventory, not merely imprecise. Any client generated from the spec silently lacks this endpoint.
- Discovery is also unusual in shape: it returns **links to hourly JSON files on S3**, not the data itself — a two-stage retrieval no other endpoint uses.
- Its error table also diverges from the global one: `429` is documented as "more than 20 per second", and both 401 and 403 read "The OAuth token is invalid."

## Claim E11

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OpenAPI specification — `getTeamProjects` description
- URL: https://github.com/figma/rest-api-spec
- Type: official machine-readable specification (primary)

Notes:
- Figma states directly: "it is not currently possible to programmatically obtain the team id of a user just from a token. To obtain a team id, navigate to a team page of a team you are a part of."
- There is no teams-list endpoint anywhere in the surface. Team ID must therefore be user-supplied configuration.
- Directly determines `cyber-figma`'s config surface (`FIGMA_TEAM_ID` + `--team`), mirroring cyber-asana's workspace GID.

## Claim E12

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OpenAPI specification — `getImages` and `getImageFills` descriptions
- URL: https://github.com/figma/rest-api-spec
- Type: official machine-readable specification (primary)

Notes:
- Rendered image URLs (`GET /v1/images/:key`) "expire after 30 days"; images up to 32 megapixels, larger are scaled down.
- Image-fill URLs (`GET /v1/files/:key/images`) expire "after no more than 14 days" — a *different, shorter* window that is easy to conflate.
- `images` map values may be `null`, meaning that specific node failed to render; every requested node ID is guaranteed present as a key regardless. A null is not an API error and must not be retried as one.

## Claim E13

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OpenAPI specification — `postDevResources` / `putDevResources` descriptions
- URL: https://github.com/figma/rest-api-spec
- Type: official machine-readable specification (primary)

Notes:
- Bulk dev-resource writes return **200 even when some items fail**; failures appear in an `errors` array alongside `links_created` / `links_updated`.
- Documented failure causes: unknown `file_key`; the node already holds the maximum of **10** dev resources; a duplicate URL on the same node.
- Consequence: HTTP status is insufficient to determine success. The gateway must inspect the body and surface partial failure explicitly.

## Claim E14

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OpenAPI specification — `postVariables` description; Figma variables guide
- URL: https://developers.figma.com/docs/rest-api/variables/
- Type: official documentation + machine-readable specification

Notes:
- `POST /v1/files/:file_key/variables` applies four arrays in a fixed order: `variableCollections` → `variableModes` → `variables` → `variableModeValues`, and within each, in array order.
- Hard limits: **40 modes per collection**, mode names ≤ **40 characters**, **5000 variables per collection**; variable names must be unique within a collection and cannot contain characters such as `.{}`.
- Response returns `tempIdToRealId`, mapping caller-supplied temporary IDs to real ones — required to correlate a bulk create.
- Variables written via REST **must be published** before other files observe them, and no publish operation exists in the REST surface.

## Claim E15

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: `@figma/rest-api-spec` npm registry metadata; `figma/rest-api-spec` repo metadata
- URL: https://registry.npmjs.org/@figma/rest-api-spec
- Type: package registry / repository metadata

Notes:
- Latest published version is **0.41.0** (registry modified 2026-07-09); repository `pushed_at` 2026-07-01. The analysed snapshot is therefore the current one, not a stale copy.
- Recent cadence (0.36.0 → 0.41.0) shows the spec is actively maintained, which supports using it as the backbone while also meaning **the inventory will drift** and needs a recheck trigger tied to this version number.
- Repo carries 215 stars and 29 open issues at time of research — small enough that the issue tracker is a tractable corrective source, as used in E03/E04/E06/E07.

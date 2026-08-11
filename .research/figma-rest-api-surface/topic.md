# Figma REST API Surface (August 2026)

## Question

What is the complete, accurate surface of the Figma REST API — every endpoint group, its parameters, response shape, pagination model, and error behavior — at a fidelity sufficient for `cyber-figma` to be implemented against it without further discovery?

## Scope

**In scope**

- Every HTTP operation reachable on `api.figma.com`, GET and mutating.
- Parameters (required/optional), response-shape highlights, pagination model, per-endpoint error notes.
- The accuracy of the sources themselves — specifically where Figma's machine-readable spec and its prose docs disagree.

**Out of scope**

- Plan/seat gating, scopes, rate-limit quotas, and token lifecycle → see the sibling topic `figma-plans-and-limits`.
- The Plugin API, Widget API, and Figma's own MCP server. These are separate products; only their intersections with REST are noted.
- SCIM resource endpoints. SCIM is a distinct API (different host, auth, and versioning) and is recommended out of scope for the wrapper.
- Node-type schemas (the `Node` union and its ~30 variants). Enormous, and needed only when rendering document trees, not when designing the command surface.

## Source angles

- **Machine-readable primary** — Figma's official OpenAPI specification (`figma/rest-api-spec`), parsed programmatically rather than read prose-first.
- **Official prose docs** — `developers.figma.com/docs/rest-api/`, which carry material the spec omits entirely.
- **The spec's own issue tracker** — the corrective angle: what does Figma's spec get *wrong*, per the people generating clients from it?
- **Release/versioning metadata** — npm + repo metadata, to establish whether the spec snapshot is current.
- **Endpoint-level docs cross-check** — per-endpoint error tables and return values, which differ from both the spec and the global errors page.

## Findings

### The spec is the best source, and it is not sufficient alone

The OpenAPI spec (v0.41.0) defines **50 operations** and is the only source that is complete, structured, and verifiable [E01]. It is the correct backbone for the inventory.

But Figma labels it **beta** in its own `info.description`, warning of "inaccuracies" given the API's "large surface area and complexity" [E02]. That warning is substantiated: the repo carries 29 open issues, several of which are concrete, still-reproducing defects [E03, E04, E07]. Treating the spec as ground truth without cross-checking would propagate its bugs into `cyber-figma`.

Crucially, the spec also has **holes**: the Discovery API is fully documented in prose and **entirely absent from the spec** [E10]. Any implementation generated purely from the spec silently lacks it.

### The `number` vs `integer` defect is the highest-value finding

Issue #86 reports that `page_size`, `before`, and `after` on the versions endpoint are typed `type: number` where they are semantically integers. Code generators therefore emit floating-point types, serialize `30` as `30.0`, and the API rejects it with a 400: `"'page_size' must be a valid number, received type String"` [E03].

Verifying against v0.41.0 directly, the problem is **broader than the issue reports** — 15 parameters across 6 endpoints are affected, spanning versions, all three team-library list endpoints, and activity logs [E03]. Newer endpoints (`ai_usage`, `oembed`) correctly use `integer`, indicating Figma fixed the pattern going forward without backfilling.

This is directly actionable: `cyber-figma` must coerce these to integers at the boundary, and must not naively codegen its client.

### The spec and the prose docs disagree about `err`

The spec's `GetFileNodesResponse` has no `err` property; the prose docs for the same endpoint document `"err": String` in the return value [E04]. The same applies to `GET /v1/images`, where the spec types `err` as always-`null` while the docs' error table states "400: Invalid parameter, **the `err` property will indicate which parameter is invalid**" [E05].

So `err` is not decorative: on success it is null, and on a 400 it carries the diagnostic. A client typed strictly from the spec would discard the most useful error detail the API returns.

### Open issues are not the same as current defects

Issue #30 (`GetFileResponse` missing `linkAccess`) is still open, but `linkAccess` **is present** in v0.41.0 [E06]. The issue was fixed without closure. This is why every complaint was re-verified against the actual spec snapshot rather than trusted from its title — and why the evidence log records verification status separately from issue status.

### Pagination is four incompatible models, and most endpoints have none

The API uses four distinct pagination models — full-URL `prev_page`/`next_page`, integer id-cursors, opaque cursor + `next_page` boolean, and opaque cursor + a "more?" boolean whose field names differ per endpoint [E08]. The majority of list endpoints do not paginate at all and return complete sets, which is a scaling hazard on large files and teams rather than a convenience.

Normalizing this once in a shared module is the single highest-leverage architectural decision for the wrapper.

### The write surface is deliberately narrow

Only **11 of 50 operations mutate** state, confined to comments, reactions, webhooks, variables, and dev resources [E09]. Nothing in the REST API creates or deletes files, projects, teams, pages, or nodes. Design work lives in the Plugin API. A CLI/MCP wrapper is therefore overwhelmingly a *read* tool, which also shapes which rate-limit tiers matter most.

Two operations are traps: `POST /v1/developer_logs` is a **read** with a filter body, and dev-resource bulk writes return **`200` with a partial-failure `errors` array** — a 2xx is not proof of success [E13].

### Practical constraints that will otherwise be discovered in production

Rendered image URLs expire after 30 days; image-fill URLs after no more than 14 [E12]. Variable collections cap at 40 modes and 5000 variables [E14]. There is **no way to obtain a team ID from a token** — Figma states this outright, so the team ID must be configuration [E11].

## Contradictions

- **Spec vs prose docs on `err`** — spec omits it on file-nodes and types it always-null on images; docs document it as a populated diagnostic string on 400 [E04, E05]. *Resolution: trust the docs; treat `err` as `string | null`.*
- **Spec vs prose docs on the analytics path parameter name** — spec calls it `file_key`, the web docs call it `library_file_key` [E07]. *Resolution: immaterial on the wire (it is a path segment); matters only for generated parameter naming.*
- **Issue tracker vs spec reality** — issue #30 reports a defect that no longer reproduces [E06]. *Resolution: verify every reported defect against the pinned spec version; record both.*

## Open questions

- Does `GET /v1/activity_logs` accept a `cursor` request parameter? The response returns `cursor` and `next_page`, but no cursor *input* is documented, so the returned cursor has nowhere to go. Undocumented; needs a live probe with an Enterprise token.
- What endpoint consumes the `selections:read` scope? It is published in the scope table with no documented consumer.
- Is `file_code_connect:write` a real scope? Referenced on the plan-access-tokens page as unsupported, absent from the published scope table, required by no spec operation.
- Are the `number`-typed params in [E03] rejected in practice on *all* six endpoints, or only where the issue reporter tested (versions)? Verified as a spec defect; the runtime rejection is confirmed only for `page_size`.
- Does the REST API expose any publish operation for variables? Writes require publishing before other files observe them, and no publish endpoint exists in either source.

## Sources consulted

- Figma OpenAPI specification v0.41.0 — <https://github.com/figma/rest-api-spec> (`openapi/openapi.yaml`)
- Figma REST API docs (index) — <https://developers.figma.com/docs/rest-api/>
- Figma file endpoints reference — <https://developers.figma.com/docs/rest-api/file-endpoints/>
- Figma errors reference — <https://developers.figma.com/docs/rest-api/errors/>
- Figma webhooks guide — <https://developers.figma.com/docs/rest-api/webhooks/>
- Figma variables guide — <https://developers.figma.com/docs/rest-api/variables/>
- Figma Discovery endpoints — <https://developers.figma.com/docs/rest-api/discovery-endpoints/>
- Figma REST API changelog — <https://developers.figma.com/docs/rest-api/changelog/>
- `figma/rest-api-spec` issue tracker — <https://github.com/figma/rest-api-spec/issues>
- `@figma/rest-api-spec` on npm — <https://registry.npmjs.org/@figma/rest-api-spec>

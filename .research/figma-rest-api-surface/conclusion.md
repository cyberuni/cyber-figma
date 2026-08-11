# Figma REST API Surface Conclusion

## Last updated

August 2026

## Question

What is the complete, accurate surface of the Figma REST API, and can it be implemented against directly from Figma's published sources?

## Verdict

The Figma REST API is a **53-operation surface**: 50 defined in Figma's official OpenAPI specification (v0.41.0), plus `GET /v1/discovery` which is documented in prose but absent from the spec, plus the two OAuth token endpoints. SCIM is a genuinely separate API on a different host and should stay out of scope for a REST wrapper.

**It is overwhelmingly a read API.** Only 11 operations mutate, confined to comments, comment reactions, webhooks, variables, and dev resources. Nothing in REST creates or deletes files, projects, teams, pages, or nodes — design mutation lives in the Plugin API. A CLI/MCP wrapper is therefore a read tool with a narrow write tail, which should shape both the command surface and which rate-limit tiers matter.

**The OpenAPI spec is the right backbone but must not be used alone.** Figma self-describes it as beta and warns of inaccuracies, and that warning is substantiated. Three concrete defects still reproduce in v0.41.0: 15 numeric parameters across 6 endpoints are typed `number` where they are integers (generated clients serialize `30` as `30.0` and get a 400); `GetFileNodesResponse` omits the `err` property the docs document; and the analytics path parameter is named inconsistently between spec and docs. Separately, the spec is *incomplete* — the entire Discovery endpoint is missing. **Do not ship a naively generated client.** Hand-write the gateway, use the spec as the parameter/shape reference, and coerce integer parameters at the boundary.

**Pagination is the dominant architectural concern.** Four mutually incompatible models coexist — full-URL next/prev links, integer id-cursors, opaque cursor plus `next_page`, and opaque cursor plus a "more?" flag whose field names and exhaustion sentinels differ per endpoint. Worse, the majority of list endpoints do not paginate at all and return complete sets, which is a scaling hazard on large files and teams rather than a convenience. Normalizing all of this behind one `PaginationOptions`/`PaginatedResult` shape is the highest-leverage decision in the wrapper's design.

Three operational facts will otherwise be discovered painfully in production: rendered image URLs expire after 30 days while image-fill URLs expire after no more than 14; bulk dev-resource writes return **200 with a partial-failure `errors` array**, so HTTP status is not a success test; and there is **no way to obtain a team ID from a token**, so it must be configuration.

## Confidence

**High** for the inventory, parameters, response shapes, and pagination models — these come from a machine-readable primary source, were extracted programmatically rather than read prose-first, and the spec snapshot was confirmed current (v0.41.0, published 2026-07-09).

**High** for the spec-defect findings — each reported defect was independently re-verified against the pinned snapshot rather than trusted from its issue title, which is how one reported defect (E06) was correctly identified as already fixed.

**Medium** for completeness of undocumented behavior. Nothing here was validated against the live API; no requests were made. Runtime behavior that both sources omit remains unknown.

## Strongest support

- [E01] 50 operations enumerated programmatically from Figma's official OpenAPI spec — complete, structured, verifiable.
- [E03] The `number` vs `integer` defect independently reported by a practitioner *and* re-verified in v0.41.0, where it proved broader than reported (15 params / 6 endpoints).
- [E08] All four pagination models derived directly from the spec's parameters and 200 schemas.
- [E15] Spec snapshot confirmed to be the current release, so the inventory is not stale.

## Strongest counterevidence

- [E02] Figma explicitly labels the specification **beta** and warns of inaccuracies — a first-party caution against treating the primary source as ground truth.
- [E10] The spec is demonstrably *incomplete*, not merely imprecise: Discovery is entirely absent. Other omissions may exist that were not detected, since absence cannot be found by reading the spec.
- [E04, E05] Spec and prose docs actively disagree about `err`, proving neither source alone is sufficient.
- [E06] An open issue reporting a defect that no longer reproduces — evidence that the issue tracker overstates current defects and cannot be read as a defect list.

## Not supported

- That the spec can be code-generated into a correct client. It cannot, on current evidence [E03, E04, E10].
- That HTTP status codes reliably indicate success. Dev-resource bulk writes return 200 on partial failure [E13].
- That `err` is always null. That is the spec's claim; the docs contradict it for 400 responses [E05].
- That open-issue count reflects current defect count [E06].
- That the REST API can edit designs, or publish variables it has written [E09, E14].
- Any claim about live runtime behavior. **No request was made against the live API in this research.**

## Thin evidence

- **Live validation is entirely absent.** Every claim is documentary. The `number`/`integer` rejection is confirmed at runtime only for `page_size`, and only via a third party's report.
- **Activity Logs pagination** — the response carries a `cursor` with no documented request parameter to pass it back to. Genuinely undocumented; needs an Enterprise token to probe.
- **`GET file meta` and node-type schemas** were not exhaustively enumerated; the former's top-level fields were verified, the latter deliberately deferred.
- **Orphan scopes** — `selections:read` has no documented consumer, and `file_code_connect:write` is referenced but unpublished. Neither could be resolved from documentation.
- **Third-party client implementations** were only lightly sampled (registry metadata), not read for divergence patterns. A deeper pass could reveal further spec-vs-reality gaps.

## Recheck triggers

- **`@figma/rest-api-spec` publishes a version above 0.41.0** — the primary staleness signal; re-run the programmatic extraction and diff the operation list.
- Any of issues #86, #81, #28 closes, or new spec-accuracy issues are filed against endpoints `cyber-figma` wraps.
- The REST API changelog announces a new endpoint group (cadence has been roughly quarterly: Discovery 2025-06, oEmbed 2026-03, AI Usage 2026-06).
- First contact with the live API — every "thin evidence" item above should be converted to a verified claim once a token is available, especially the integer-coercion hazard.
- Figma publishes a Discovery entry in the OpenAPI spec, or the spec exits beta.

# Figma Plans and Limits Conclusion

## Last updated

August 2026

## Question

What does the Figma REST API gate behind plan tier, seat type, and auth mode; what rate limits apply; and which auth mode should `cyber-figma` default to?

## Verdict

**Default to a personal access token** via `FIGMA_ACCESS_TOKEN`, with a `--token` per-invocation override, mirroring cyber-asana's convention. **Support plan access tokens as a first-class second mode** (identical `X-Figma-Token` header, so it is nearly free to add) for CI and org automation. **Defer OAuth 2.**

The reason is capability coverage, not preference: **no auth mode is a superset of the others.** Plan access tokens cannot write comments or variables, and cannot call `/v1/me` or `/v1/oembed`. OAuth cannot call Payments at all. Activity Logs refuses personal tokens entirely. Only the personal access token spans the whole surface a local CLI/MCP wrapper would plausibly want, works on every plan including Starter, and needs no callback server or app review — which is exactly the "scripts and local tooling" case Figma names for it.

Its two real weaknesses must be designed around rather than ignored. First, a PAT's quota is **per-user**, so every process sharing one competes for one budget — ship `Retry-After`-aware backoff from day one. Second, PATs **max out at 90 days** with no programmatic rotation (the "no expiration" option was removed), and expiry surfaces as a **403, not a 401**, so it must produce an actionable message rather than a generic permission error.

**Access is an intersection of four things** — plan tier, seat type, auth mode, and scope — and scopes never exceed the user's underlying Figma permissions. The rule most likely to cause support burden is that **rate limits follow the plan the requested resource lives in**, not the best plan the caller belongs to. A confirmed field case shows a Professional/Full-seat user receiving Viewer-tier limits purely because the file had drifted back under a free account.

**Six domains are Enterprise-gated**: Variables (read *and* write), Library Analytics, Activity Logs, Developer Logs, AI Usage, and Discovery. Developer Logs and Discovery additionally require the Governance+ add-on; four of the six additionally require org-admin rights. Variables is the common trap — reading variables is Enterprise-gated, not merely writing them, and writing further requires a Full seat with guests excluded. These should degrade with an explicit "requires an Enterprise plan" message rather than a bare 403.

**The headline operational risk is the Tier 1 / View-seat cliff**: View and Collab seats get **6 `GET file`-class requests per month on every plan, Enterprise included**, and Figma notes the real figure may be lower under load. Any tool whose primary flow is reading a file is unusable for those seats.

## Confidence

**High** for the quota table, tier membership, scope list, Enterprise gating, and token lifecycle. These come from Figma's own documentation, and the single most consequential artifact — the quota table — was verified by parsing raw HTML from **two independently authored official pages** that agree structurally.

**High** for the auth-mode recommendation, which follows from documented capability sets rather than judgment about ergonomics.

**Medium** for practitioner-sourced items (the misdiagnosis case, PAT expiry history) — well-attested but single-thread, without vendor-published root-cause statements.

**Low** for anything about live behavior. **No request was made against the live API**, and no Enterprise-tier feature was observed working.

## Strongest support

- [E02, E03] The quota table parsed structurally from two independent official pages with identical `rowspan` semantics — the strongest claim in the topic.
- [E07] Plan access tokens' five unsupported endpoint classes, stated verbatim by Figma; this alone rules them out as the sole default credential.
- [E05, E06] Enterprise gating cross-checked between prose "who can use this" pages and the OpenAPI `security` blocks — two source types agreeing.
- [E11] 429 semantics and per-auth-mode accounting, including Figma's own worked example of a shared PAT being collectively throttled.

## Strongest counterevidence

- [E04] A field report that *appears* to refute the documented rate-limit model (Pro plan + Full seat receiving `low` limits). It resolves in the model's favour — the resource lived in a Starter context — but demonstrates the documented model is not observably true from the client's side without inspecting file location.
- [E03] Two separate rendered-text summarizations of the quota table produced a **wrong** reading before the structural parse corrected it. The single most important table in this topic is actively misleading when consumed the ordinary way.
- [E09] The 90-day PAT maximum — the linchpin of the auth recommendation's weakness analysis — is **not stated on the personal-access-tokens page itself**; it is sourced from a comparison table on the plan-token page plus community corroboration.
- [E12] Dev Mode gating is single-sourced from a help-center page describing product packaging, which changes more often than developer docs.

## Not supported

- That plan access tokens are the most capable credential. They are the most *governable*; they are strictly less capable [E07].
- That Enterprise gating applies only to variable *writes*. Reads are gated too [E06].
- That a paid plan guarantees `high` rate limits. It depends on where the file lives [E01, E04].
- That the Dev Resources REST endpoints are plan-gated. The Dev Mode surface is; the endpoints are not documented as such [E12].
- That `selections:read` grants access to any known endpoint, or that `file_code_connect:write` is a published scope [E10].
- Any claim that a specific Enterprise feature works as documented in practice — none was exercised.

## Thin evidence

- **No live validation of any kind.** No token was used; no 429 was observed; no Enterprise endpoint was called.
- **PAT expiry options** below the 90-day maximum are undocumented, as is any cap on tokens per account [E09].
- **Whether Figma's hosted MCP server consumes the same REST quota** is unaddressed by the rate-limit docs, though Developer Logs treats `mcp_server` as a distinct event source, hinting at separate accounting.
- **Non-admin Enterprise access to Library Analytics** is documented as permitted with filtered results, but unverified — and the obfuscated-row behavior ("Team not visible") has real consequences for aggregation that were not tested.
- **Government plan** (`api.figma-gov.com`) gating was noted but not investigated.
- Practitioner evidence rests on a small number of forum threads; a broader sweep could strengthen or complicate [E04] and [E09].

## Recheck triggers

- **The rate-limits page changes**, or its "as of" date moves past 2025-11-17. Figma states outright it "reserves the right to change rate limits", so this table is the most volatile artifact here — re-parse the HTML, do not read the rendered text.
- Figma changes PAT maximum expiry, restores a non-expiring option, or adds programmatic PAT rotation — any of which would materially strengthen the default-auth recommendation.
- Plan access tokens gain support for `file_comments:write` or `file_variables:write`, or for `/v1/me` — which would make them a viable default and change the verdict.
- Variables, Library Analytics, or any currently Enterprise-gated domain moves down-tier.
- `cyber-figma` gains a requirement for Activity Logs or Discovery — both are unreachable with a personal access token and would force the deferred OAuth work.
- First contact with the live API: convert every "thin evidence" item into a verified claim, starting with observed 429 headers.

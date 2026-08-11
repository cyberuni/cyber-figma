# Figma Plans and Limits (August 2026)

## Question

What does the Figma REST API gate behind plan tier and seat type, what does each auth mode unlock, and what rate limits apply — at a fidelity sufficient to decide `cyber-figma`'s default auth mode and to produce accurate "you can't do this" errors rather than bare 403s?

## Scope

**In scope**

- Plan gating (Starter, Professional, Organization, Enterprise, plus the Governance+ add-on) per endpoint group.
- Seat gating (View, Collab, Dev, Full) and its effect on rate limits.
- The three auth modes — personal access token, plan access token, OAuth 2 — and the endpoint subset each can reach.
- The full OAuth scope list and token lifecycle/expiry/rotation behavior.
- Rate-limit tiers, quotas, and 429 semantics.

**Out of scope**

- Endpoint parameters and response shapes → sibling topic `figma-rest-api-surface`.
- Figma's consumer pricing in currency terms. Plan *names* matter here; prices do not.
- SCIM resource endpoints and SSO/IdP configuration, beyond the plan floor for SCIM access.
- Figma's own hosted MCP server, which authenticates on its own path and does not use REST scopes.

## Source angles

- **Official developer docs** — the rate-limits, scopes, and per-API "who can use this" pages.
- **Machine-readable primary** — the OpenAPI spec's per-operation `security` blocks, which encode auth-mode support independently of the prose.
- **Raw HTML parsing rather than rendered text** — because the central quota table's meaning lives in `rowspan` attributes that flatten incorrectly in any markdown conversion.
- **A second independent official surface** — Figma's help center, to corroborate the quota table from a separately authored page.
- **Practitioner reports** — the Figma community forum, for how the documented model actually behaves and where it surprises people.

## Findings

### Access is an intersection of four things, not one

A call succeeds only if the plan tier, the seat type, the auth mode, and the token scope all permit it [E01]. Scopes never exceed the user's underlying Figma permissions — Figma states that scopes "do not supersede the permissions granted to you by an organization or the owner of a project, team, or file" [E10].

The most consequential and least intuitive rule: **rate limits follow the plan that the requested resource lives in, not the best plan the caller belongs to** [E01]. A Full seat in an Enterprise org gets Starter limits when touching a file that sits in a Starter plan.

### The quota table's real shape is carried in `rowspan`, and flattening it produces a wrong answer

The rate-limit table has a `rowspan="2"` on each Starter cell, meaning **the Starter value spans both seat rows** — on Starter, Dev/Full seats get the same quota as View/Collab (6/month, 5/min, 10/min by tier). The three values in each Dev/Full row map to Professional, Organization, and Enterprise [E02].

Any rendered-text or markdown conversion drops the `rowspan` and silently shifts those three values left by one column, yielding the plausible-but-wrong reading that Starter Dev/Full gets 10/min. This was independently confirmed by parsing a **second, separately authored** official page (Figma's help center), which carries the identical structure [E03]. This is recorded because it is a reproducible trap for anyone re-deriving the table.

### The Tier 1 / View-seat cliff is the headline operational risk

View and Collab seats get **6 requests per month** to `GET file`, `GET file nodes`, and `GET images` — on *every* plan including Enterprise [E02]. Figma further notes these are ceilings, not guarantees: under load a Viewer "might only be able to make 2 requests in a month."

Any tool whose primary flow is "read a file" is effectively unusable on those seats. This is a product-shaping constraint, not a tuning detail.

### The documented model is correct, but misdiagnosis is the norm

A forum report of a Professional-plan, Full-seat user receiving `X-Figma-Rate-Limit-Type: low` and a `Retry-After` of ~4.5 days looks like a contradiction of the documented model. It is not: the root cause was that the *file* had been moved back under the user's free account, so the resource lived in a Starter context [E04].

This confirms the resource-location rule from an independent angle, and identifies the single most likely support burden for `cyber-figma`: users will read `low` on a paid plan as a bug. Surfacing `X-Figma-Plan-Tier` and `X-Figma-Upgrade-Link` in the error, and naming file location as the likely cause, converts a mystery into a self-service fix.

### Six domains are Enterprise-gated, two of them additionally behind Governance+

Variables (**read as well as write**), Library Analytics, Activity Logs, Developer Logs, AI Usage, and Discovery all require Enterprise [E05]. Developer Logs and Discovery additionally require the **Governance+** add-on, and four of the six additionally require org-admin rights [E05, E06].

Variables is the one most likely to surprise: people assume only *writing* variables is gated, but reading them requires Enterprise too. Writing further requires a **Full seat**, and guests are excluded outright [E06].

### Each auth mode has a different reachable endpoint set — none is a superset

Plan access tokens, despite being the "organization automation" credential, **cannot** reach five things: anything requiring `file_variables:write`, `file_comments:write`, or `file_code_connect:write`, plus `/v1/me` and `/v1/oembed` [E07]. OAuth cannot reach Payments at all [E08]. Activity Logs accepts only plan tokens or org OAuth — not a personal token [E05].

So the choice of default credential is a real constraint on the feature set, not a preference. Only the personal access token spans the whole surface a wrapper would plausibly want.

### Token lifecycle differs sharply per mode

Personal access tokens max out at **90 days** and cannot be rotated programmatically; the previously available "no expiration" option was removed, which generated sustained community friction about 90-day CI/CD churn [E09]. Plan access tokens last up to **365 days** and support refresh with a **24-hour grace period** on the old secret — the only zero-downtime rotation story in the API [E07]. OAuth access tokens expire after 90 days, authorization codes expire after **30 seconds**, and Figma keeps only **one access token per app per user**, so refreshing immediately invalidates the previous one [E08].

## Contradictions

- **Rendered-text reading vs HTML structure of the quota table** — flattened conversions place Starter Dev/Full at 10/min; the `rowspan` structure places it at 6/month [E02, E03]. *Resolution: the HTML structure is authoritative, and two independently authored official pages agree.*
- **Forum report vs documented rate-limit model** — a Pro/Full user receiving `low` limits appears to contradict the table [E04]. *Resolution: not a contradiction; the resource lived in a Starter-plan context, which is exactly what the documentation specifies.*
- **"Plan tokens are for org automation" vs their capability set** — the positioning implies breadth, but they cannot write comments or variables, or call `/v1/me` [E07]. *Resolution: both true; plan tokens are a read/automation credential, not a general-purpose one.*

## Open questions

- What are the *selectable* PAT expiry options below the 90-day maximum? The docs say "set the expiration" without enumerating choices.
- Is there a cap on the number of personal access tokens per account? Undocumented.
- Does `library_analytics:read` work for a non-admin Enterprise user in practice? Docs say any user with a seat, with results filtered by permission — unverified.
- Which endpoint consumes `selections:read`, and is `file_code_connect:write` a real published scope? Neither resolves from documentation.
- Do Figma's own MCP server calls consume the same per-user REST quota? The help-center rate-limit page does not address it, and Developer Logs treats `mcp_server` as a distinct event source, implying separate accounting — unconfirmed.

## Sources consulted

- Figma rate limits — <https://developers.figma.com/docs/rest-api/rate-limits/>
- Figma scopes — <https://developers.figma.com/docs/rest-api/scopes/>
- Figma authentication overview — <https://developers.figma.com/docs/rest-api/authentication/>
- Figma personal access tokens — <https://developers.figma.com/docs/rest-api/personal-access-tokens/>
- Figma plan access tokens — <https://developers.figma.com/docs/rest-api/plan-access-tokens/>
- Figma OAuth apps — <https://developers.figma.com/docs/rest-api/oauth-apps/>
- Figma Variables / Library Analytics / Activity Logs / Developer Logs / AI Usage / Discovery / Payments / Webhooks / SCIM guides — <https://developers.figma.com/docs/rest-api/>
- Figma OpenAPI specification v0.41.0 (`security` blocks) — <https://github.com/figma/rest-api-spec>
- Figma help center, "What if I'm rate-limited?" — <https://help.figma.com/hc/en-us/articles/34963238552855-What-if-I-m-rate-limited>
- Figma help center, "Guide to Dev Mode" — <https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode>
- Figma community forum, rate-limit and token-expiry threads — <https://forum.figma.com/>

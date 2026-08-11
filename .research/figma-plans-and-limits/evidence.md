# Evidence

Evidence for the `figma-plans-and-limits` topic. Entries are in ascending claim-ID order; new entries append at the end.

## Claim E01

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma REST API rate limits documentation
- URL: https://developers.figma.com/docs/rest-api/rate-limits/
- Type: official documentation (primary)

Notes:
- Limits are determined by three factors: "The seat type of the user", "The rate limit tier of the endpoint", and "The location and plan of the resource that the user is requesting."
- The resource-location rule is stated explicitly: "if you use a personal access token to get the content of a file in a Starter plan, requests to that file are limited to up to 6 per month **even if you have a Full seat in a different plan**."
- Reinforced in a second passage: personal access tokens "are for your whole account, not tied to specific plans" — enterprise limits apply only to files residing in that plan.
- This is the rule most likely to be misdiagnosed in the field; see E04 for a confirmed real-world instance.

## Claim E02

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma REST API rate limits documentation — quota table, parsed from raw HTML
- URL: https://developers.figma.com/docs/rest-api/rate-limits/
- Type: official documentation (primary), structural parse

Notes:
- Parsed the `<table>` element directly rather than reading converted text. Each Starter cell carries `rowspan="2"`, so **the Starter value spans both the View/Collab and Dev/Full rows**.
- Correct reading — Tier 1: Starter 6/month (both seat groups), then Dev/Full = Professional 10/min, Organization 15/min, Enterprise 20/min. Tier 2: Starter 5/min; Dev/Full = 25 / 50 / 100 per min. Tier 3: Starter 10/min; Dev/Full = 50 / 100 / 150 per min. View/Collab is a flat 6/month, 5/min, 10/min respectively on every plan.
- Tier membership — **Tier 1**: GET file, GET file nodes, GET image. **Tier 2**: Comments, Dev Resources, Discovery, GET image fills, GET team projects, GET project files, GET local/published variables, Version History, Webhooks. **Tier 3**: Activity Logs, Components & Styles, Developer Logs, GET file metadata, Library Analytics, Payments, GET project metadata, Users, **POST variables**.
- Two counterintuitive placements: `POST variables` (a write) sits in the *cheapest* tier, and `GET file metadata` is Tier 3 while `GET file` is Tier 1 — making metadata-first flows far cheaper.
- Figma qualifies the View/Collab figures as ceilings: "Depending on traffic and demand, the actual limit may be lower … might only be able to make 2 requests in a month."
- Current limits took effect **2025-11-17**, and Figma "reserves the right to change rate limits."

## Claim E03

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma help center, "What if I'm rate-limited?" — same table, independently authored page, parsed from raw HTML
- URL: https://help.figma.com/hc/en-us/articles/34963238552855-What-if-I-m-rate-limited
- Type: official documentation (secondary surface), structural parse

Notes:
- Corroborates E02 from a **different official page**: identical table structure, identical `rowspan="2"` on every Starter cell, identical values.
- Two independent official sources agreeing on structure raises confidence in the `rowspan` reading from "my parse says so" to "the publisher's data model says so."
- **Methodological finding worth preserving:** automated text/markdown conversion of either page drops the `rowspan` and shifts the three Dev/Full values one column left, producing the plausible-but-wrong claim that Starter Dev/Full gets 10/min. Two separate rendered-text summarizations of these pages produced exactly that error before the structural parse corrected it. Anyone re-deriving this table must parse the HTML.

## Claim E04

Date: 2026-08-11
Status: supports
Confidence: medium

Source:
- Label: Figma community forum — "REST API rate limits: Pro plan with Full seat still getting X-Figma-Rate-Limit-Type low and multi-day Retry-After"
- URL: https://forum.figma.com/report-a-problem-6/rest-api-rate-limits-pro-plan-with-full-seat-still-getting-x-figma-rate-limit-type-low-and-multi-day-retry-after-51333
- Type: practitioner report / community forum thread with vendor-support participation

Notes:
- Reported symptom: Professional plan, Full seat, calling the Images endpoint, receiving `429` with `X-Figma-Rate-Limit-Type: low` and `Retry-After: 396749` (~4.5 days) — i.e. Viewer-tier treatment on a paid plan.
- Figma community support's diagnosis: "the file they're working in isn't located within the team they upgraded." A participant confirmed the root cause — an imported `.fig` file had been placed back under their *free* account, and keeping it in the Pro Drafts folder restored `high` limits.
- **Confirms rather than contradicts** the documented model (E01): the limit followed the resource's plan.
- Value for `cyber-figma`: this is the most likely support burden. A `low` rate-limit type on a paid plan reads as a bug to users. Error output should surface `X-Figma-Plan-Tier` and name file location as the probable cause.
- Confidence medium, not high: a single thread with a self-reported resolution, not a vendor-published root-cause statement.

## Claim E05

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma per-API "who can use this" pages (Activity Logs, Library Analytics, Developer Logs, AI Usage, Discovery) cross-checked against OpenAPI `security` blocks
- URL: https://developers.figma.com/docs/rest-api/activity-logs/
- Type: official documentation + machine-readable specification

Notes:
- **Enterprise-gated domains (6):** Variables, Library Analytics, Activity Logs, Developer Logs, AI Usage, Discovery.
- **Governance+ add-on additionally required (2):** Developer Logs, Discovery.
- **Org-admin additionally required (4):** Activity Logs, Developer Logs, AI Usage, Discovery.
- Library Analytics is the exception among the org-scoped ones: "Any user with a seat in an Enterprise plan is able to query" it, with results filtered — and inaccessible teams/files returned with **obfuscated names** ("Team not visible", "File not visible") rather than omitted, which affects any aggregation logic.
- Auth-mode asymmetries confirmed from the spec's `security` blocks: Activity Logs accepts `PlanAccessToken` or `OrgOAuth2` only — **no personal access token**. Developer Logs and AI Usage accept **plan access tokens only**.
- SCIM has a separate floor: "not supported on the Starter or Professional Plan."

## Claim E06

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma Variables documentation — requirements table
- URL: https://developers.figma.com/docs/rest-api/variables/
- Type: official documentation (primary)

Notes:
- Verbatim requirements table — GET: plan Enterprise, account type "Any organization member", file permission "View access", scope `file_variables:read`. POST: plan Enterprise, account type "**Full seats, admins**", file permission "Edit access", scope `file_variables:write`.
- Prose adds: "you must have a Full seat in an Enterprise org; **guests cannot use the API**."
- The commonly-missed part is that **reading** variables is Enterprise-gated, not just writing. A tool should gate both.
- The spec's operation descriptions corroborate: local/published variables are "available to full members of Enterprise orgs"; POST is "available to full members of Enterprise orgs **with Editor seats**".

## Claim E07

Date: 2026-08-11
Status: contradicts
Confidence: high

Source:
- Label: Figma plan access tokens documentation — "Supported endpoints", lifecycle sections
- URL: https://developers.figma.com/docs/rest-api/plan-access-tokens/
- Type: official documentation (primary)

Notes:
- Plan access tokens are positioned as the organization-automation credential, but **cannot** be used with: endpoints requiring `file_code_connect:write`; endpoints requiring `file_variables:write`; endpoints requiring `file_comments:write`; `/v1/me`; `/v1/oembed`.
- Practical effect: no posting/deleting comments or reactions, no variable writes, no "who am I" check. This **contradicts** the intuition that the org-scoped token is the most capable one.
- Availability: Organization and Enterprise plans only; creation requires an org admin **with MFA enabled** (unless the org enforces SSO login).
- Max expiration **365 days** vs 90 for PATs. Scoping additionally supports a **resource allowlist** (specific files/projects/teams/workspaces) — the only least-privilege resource scoping in the API.
- Refresh recomputes expiry as today + the original lifetime and **the previous secret keeps working for 24 hours** — the only zero-downtime rotation path available. Revocation is immediate and irreversible.
- Generally available since 2026-07-23 per the changelog.
- Consequence for `cyber-figma`: a connection-check command cannot rely on `/v1/me` in plan-token mode.

## Claim E08

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma OAuth apps documentation
- URL: https://developers.figma.com/docs/rest-api/oauth-apps/
- Type: official documentation (primary)

Notes:
- Authorization-code flow only (`response_type=code`); PKCE supported with **S256 only**. Authorize URL `https://www.figma.com/oauth`; token exchange `POST https://api.figma.com/v1/oauth/token`; refresh `POST https://api.figma.com/v1/oauth/refresh`. Both use HTTP Basic with base64 `client_id:client_secret`.
- **Authorization codes expire 30 seconds after issue** — exchange must be immediate and server-side.
- Access tokens expire after **90 days**. A refresh token is reusable indefinitely, but the refresh response returns **no new refresh token**.
- Figma "only maintains one access token per app for a user" — refreshing **immediately invalidates the previous access token**. A client caching stale tokens will break itself.
- The numeric `user_id` is **deprecated** in favour of `user_id_string`, because Figma user IDs "appear to be numeric, but many cannot be represented in common number formats such as JavaScript numbers and Go's float64." A JS client must never parse it as a number.
- The authorize URL must be opened in a real browser; **WebView is explicitly unsupported**.
- Apps require registration and a publishing flow (public apps are reviewed by Figma; private are not). Required for Activity Logs, Discovery, and the Embed API.
- Counter-fact for auth-mode selection: **Payments does not support OAuth 2 at all** and requires a personal access token (per the Payments guide).

## Claim E09

Date: 2026-08-11
Status: supports
Confidence: medium

Source:
- Label: Figma community forum — "Extended/No Expiration Personal access tokens" feature request thread; Figma personal access tokens documentation
- URL: https://forum.figma.com/suggest-a-feature-11/extended-no-expiration-personal-access-tokens-40595
- Type: practitioner report / community forum thread + official documentation

Notes:
- Independently corroborates the **90-day PAT maximum** asserted in the plan-access-tokens comparison table, from a second angle — and adds history the developer docs omit: the "No expiration" option **previously existed and was removed** as a security change.
- Practitioner friction is well attested: 90-day rotation imposes recurring maintenance on CI/CD pipelines and machines. Figma converted the feedback into a feature request but stated it is not on the immediate roadmap.
- The personal-access-tokens docs page itself does **not** enumerate expiry options or state the maximum; the 90-day figure comes from the plan-token comparison table and this corroboration.
- Confidence medium: the maximum is well corroborated, but the selectable option set below it remains undocumented.
- Design consequence: PAT expiry is a **routine, expected** failure mode. It should produce an actionable message, not a generic 403 — and note per the file-endpoints error table that expiry surfaces as **403**, not 401.

## Claim E10

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma scopes documentation — full scope table
- URL: https://developers.figma.com/docs/rest-api/scopes/
- Type: official documentation (primary)

Notes:
- **24 scopes** published. Enterprise-only: `file_variables:read`, `file_variables:write`, `library_analytics:read`. Enterprise + org-admin: `org:activity_log_read`, `org:ai_metering_usage_read`. Enterprise + Governance+ + org-admin: `org:developer_log_read`, `org:discovery_read`.
- **`files:read` is deprecated** — Figma calls it "extremely permissive" and "highly recommends" granular scopes. The spec reflects the transition: most read operations accept either their granular scope *or* `files:read`. A new client should request granular scopes only. The older `file_read` scope is separately deprecated for OAuth 2.
- Key constraint: "Scopes do not supersede the permissions granted to you by an organization or the owner of a project, team, or file." A scope grants no access the user does not already have.
- **Orphan scope:** `selections:read` ("Read most recent selection in files you can access") is published, but no endpoint in the spec or docs consumes it. Recorded as an open question, not an inferred capability.
- Figma's own hosted MCP server "handles its own OAuth authentication flow — you don't configure REST API scopes for it", and is limited to catalog-listed clients. This is a *different* thing from a local REST wrapper's MCP server.

## Claim E11

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma REST API rate limits documentation — 429 semantics and per-auth-mode accounting
- URL: https://developers.figma.com/docs/rest-api/rate-limits/
- Type: official documentation (primary)

Notes:
- Algorithm is a **leaky bucket**; exceeding it returns 429.
- 429 carries four fields: `Retry-After` (integer seconds), `X-Figma-Plan-Tier` (`enterprise|org|pro|starter|student`), `X-Figma-Rate-Limit-Type` (`low` for Collab/Viewer, `high` for Full/Dev), `X-Figma-Upgrade-Link` (a `/pricing` or `/settings` URL intended to be surfaced to end users).
- Accounting differs per auth mode: **OAuth** is per-user, per-plan, **per-app** (apps get isolated budgets); **plan tokens** are per-token, per-plan (so separate tokens isolate workloads); **personal tokens** are per-user, per-plan — every script sharing one PAT shares one budget.
- Figma's illustrative example: a team sharing one member's PAT gets collectively rate-limited, because all requests count against the token owner. This is a direct argument against a shared-PAT deployment pattern.
- Prescribed mitigations: batch (one `GET images` call listing many node IDs rather than one per image), cache, and honor `Retry-After` with backoff.

## Claim E12

Date: 2026-08-11
Status: mixed
Confidence: medium

Source:
- Label: Figma help center, "Guide to Dev Mode"
- URL: https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode
- Type: official documentation (help center — product surface, not developer docs)

Notes:
- Dev Mode is "Available on all paid plans" and "Requires a Full or a Dev seat."
- The **Dev Resources REST endpoints carry no documented plan gate of their own** — they behave as ordinary file-permission-scoped endpoints. What is gated is the Dev Mode product surface where those resources are displayed. Status is "mixed" because the gate applies to the consuming surface, not the API.
- Two plan-dependent details bear on the API: the **`Completed`** Dev Mode status is Organization/Enterprise only (`Ready for dev` exists on all Dev Mode plans), which changes what can fire the `DEV_MODE_STATUS_UPDATE` webhook; and **Code Connect is Organization/Enterprise only**.
- Confidence medium: help-center pages describe product packaging that changes more often than the developer docs, and this claim is single-sourced.

## Claim E13

Date: 2026-08-11
Status: supports
Confidence: high

Source:
- Label: Figma webhooks documentation — creator permissions and count limits
- URL: https://developers.figma.com/docs/rest-api/webhooks/
- Type: official documentation (primary)

Notes:
- No plan floor for webhooks generally, but **who may create** one is context-dependent: team context → team admins; project context → any user with Can edit on the project; file context → any user with Can edit on the file.
- Count limits per context: **20 per team, 5 per project, 3 per file**. Total *file* webhooks per plan: Professional 150, Organization 300, Enterprise 600 — the only plan-scaled quota outside the rate-limit table.
- Team-context webhooks fire for files available to everyone on the team or in view-only projects, and **do not fire for files in invite-only projects** — a silent-delivery-gap that will read as a bug.
- `plan_api_id` must be constructed as `team-<id>` (Professional) or `organization-<id>` (Organization/Enterprise/Government), read out of a Figma URL.
- Delivery: Figma retries failures 3 times with backoff at 5 minutes, 30 minutes, and 3 hours, and does **not** auto-deactivate persistently failing endpoints.

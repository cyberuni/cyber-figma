# Figma REST API — plans, seats, scopes, and limits

Companion to [`figma-rest-api.md`](./figma-rest-api.md). This document covers what is gated by **plan tier**, what is gated by **seat type**, the full **OAuth scope** list, **rate limits**, and **token lifecycle**.

**Primary sources** (all retrieved 2026-08-11):

- <https://developers.figma.com/docs/rest-api/rate-limits/> — quota table, 429 headers
- <https://developers.figma.com/docs/rest-api/scopes/> — canonical scope list
- <https://developers.figma.com/docs/rest-api/authentication/>, `/oauth-apps/`, `/personal-access-tokens/`, `/plan-access-tokens/`
- Per-API gating pages: `/variables/`, `/library-analytics-intro/`, `/activity-logs/`, `/developer-logs/`, `/ai-usage/`, `/discovery/`, `/payments/`, `/webhooks/`, `/scim/`
- Figma's OpenAPI spec (<https://github.com/figma/rest-api-spec>, v0.41.0) — per-operation `security` blocks
- <https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode> — Dev Mode seat/plan requirements (a help-center page, not a developer-docs page; flagged inline where used)

⚠️ Figma states directly: **"Figma reserves the right to change rate limits. Changes may affect specific endpoints, tiers, or plans."** The current limits took effect **17 November 2025**. Do not treat any number here as permanent.

**Full research record** — evidence log with confidence ratings, contradictions, and recheck triggers — lives in [`.research/figma-plans-and-limits/`](../../.research/figma-plans-and-limits/conclusion.md). This file is the reference; the conclusion there is the verdict.

> **If you re-derive the quota table below, parse the HTML.** Its meaning is carried in `rowspan` attributes, which markdown/text conversion silently drops — shifting every Dev/Full figure one plan-tier left. Two independent summarization passes made exactly that error before a structural parse caught it. The table here was verified against the raw HTML of **two** independently authored official pages.

---

## 1. The three axes of access

Access to any given call is the **intersection** of four things, not just one:

1. **Plan tier** of the resource being requested — Starter, Professional, Organization, Enterprise (plus Government, and the Governance+ add-on on Enterprise).
2. **Seat type** of the user — View, Collab, Dev, Full. This is what determines rate limits, and it is the axis most people miss.
3. **Auth mode** — personal access token, plan access token, or OAuth 2. Each supports a *different subset of endpoints*.
4. **Scope** on the token, which never exceeds the user's actual Figma permissions: *"Scopes do not supersede the permissions granted to you by an organization or the owner of a project, team, or file."*

A critical consequence, stated by Figma: a personal access token is tied to your **whole account, not a plan**. If you hold a Full seat in an Enterprise org but also have files in a Starter plan, requests against the *Starter* files get Starter limits. The limit follows **the plan the resource lives in**, not the best plan you belong to.

**This is the rule that generates support tickets.** A documented field case: a Professional-plan user with a Full seat received `X-Figma-Rate-Limit-Type: low` and a `Retry-After` of ~4.5 days from the Images endpoint — apparently Viewer-tier treatment on a paid plan. The cause was not the API: an imported `.fig` file had been placed back under the user's *free* account, so the resource lived in a Starter context. Moving it into the Pro team restored `high` limits. ([forum thread](https://forum.figma.com/report-a-problem-6/rest-api-rate-limits-pro-plan-with-full-seat-still-getting-x-figma-rate-limit-type-low-and-multi-day-retry-after-51333))

`cyber-figma` should assume users will read this as a bug. Surfacing `X-Figma-Plan-Tier` alongside the seat type — and naming file location as the likely cause — turns a multi-day mystery into a self-service fix.

---

## 2. Endpoint group → minimum plan → required OAuth scope

`—` in the plan column means no plan gate is documented; access is governed by ordinary file/project permissions and by seat-based rate limits.

| Endpoint group | Min. plan | Seat / role requirement | OAuth scope | Plan token? | PAT? |
| --- | --- | --- | --- | --- | --- |
| **Files** — `GET file`, `file nodes`, `images` | — | any (View/Collab throttled to 6/month) | `file_content:read` (or legacy `files:read`) | ✅ | ✅ |
| **Files** — `GET image fills` | — | any | `file_content:read` | ✅ | ✅ |
| **Files** — `GET file meta` | — | any | `file_metadata:read` | ✅ | ✅ |
| **Version history** — `GET file versions` | — | any | `file_versions:read` | ✅ | ✅ |
| **Projects** — team projects, project files | — | any | `projects:read` | ✅ | ✅ |
| **Projects** — project metadata | — | any | `project_metadata:read` | ✅ | ✅ |
| **Comments** — read | — | any | `file_comments:read` | ✅ | ✅ |
| **Comments / reactions** — write & delete | — | must be able to comment; **only the author may delete** | `file_comments:write` | ❌ **not supported** | ✅ |
| **Users** — `GET /v1/me` | — | any | `current_user:read` | ❌ **not supported** | ✅ |
| **Components / sets / styles** — team-scoped | — | any | `team_library_content:read` | ✅ | ✅ |
| **Components / sets / styles** — file-scoped | — | any | `library_content:read` | ✅ | ✅ |
| **Components / sets / styles** — by key | — | any | `library_assets:read` | ✅ | ✅ |
| **Webhooks v2** — read | — | see webhook creator rules below | `webhooks:read` | ✅ | ✅ |
| **Webhooks v2** — write | — | team admin / project or file editor (per context) | `webhooks:write` | ✅ | ✅ |
| **Dev Resources** — read | — | any (surfaced in Dev Mode) | `file_dev_resources:read` | ✅ | ✅ |
| **Dev Resources** — write | — | edit access | `file_dev_resources:write` | ✅ | ✅ |
| **Variables** — `GET local` / `GET published` | **Enterprise** | any org member, View access on the file; **guests excluded** | `file_variables:read` | ✅ | ✅ |
| **Variables** — `POST variables` | **Enterprise** | **Full seat or admin**, Edit access on the file | `file_variables:write` | ❌ **not supported** | ✅ |
| **Library Analytics** (6 endpoints) | **Enterprise** | any user with a seat in the Enterprise plan | `library_analytics:read` | ✅ | ✅ |
| **Activity Logs** | **Enterprise** | **org admin only** | `org:activity_log_read` (org OAuth) | ✅ | ❌ not in spec |
| **Developer Logs** | **Enterprise + Governance+** | **org admin only** | `org:developer_log_read` | ✅ **only** | ❌ |
| **AI Usage** | **Enterprise** | **org admin** (only admins can mint the required plan token) | `org:ai_metering_usage_read` | ✅ **only** | ❌ |
| **Discovery** | **Enterprise + Governance+** | **org admin only** | `org:discovery_read` | ❌ (OAuth 2 per docs) | ❌ |
| **Payments** | — | must **own** the plugin/widget/Community file | n/a — **no OAuth support at all** | ❌ | ✅ **only** |
| **oEmbed** | — | any | `file_metadata:read` | ❌ **not supported** | ✅ |
| **SCIM** (separate API) | **Organization** (not Starter/Professional) | org admin | n/a — its own bearer token + tenant ID | n/a | n/a |

### The Enterprise-gated set, restated

Six domains are **Enterprise-only**. In a CLI/MCP wrapper these should degrade with a clear "requires an Enterprise plan" message rather than surfacing a bare 403:

1. **Variables** (read *and* write — read is Enterprise too, which surprises people; only *write* additionally requires a Full seat)
2. **Library Analytics**
3. **Activity Logs** (+ org admin)
4. **Developer Logs** (+ Governance+ add-on, + org admin)
5. **AI Usage** (+ org admin)
6. **Discovery** (+ Governance+ add-on, + org admin)

**Governance+** is an Enterprise add-on and gates exactly two of these: Developer Logs and Discovery.

**SCIM** is Organization-and-up but is a separate API on `https://www.figma.com/scim/v2/:tenantid`.

### Dev Mode

The **Dev Resources REST endpoints carry no documented plan gate** — they behave like ordinary file-permission-scoped endpoints. What *is* gated is the Dev Mode product surface those resources appear in. Per Figma's help center (not the developer docs): Dev Mode is **available on all paid plans and requires a Full or a Dev seat**. Two consequences worth knowing:

- The **`Completed`** Dev Mode status is Organization/Enterprise only; `Ready for dev` exists on all plans that provide Dev Mode. This bears on the `DEV_MODE_STATUS_UPDATE` webhook event — the set of statuses that can fire it differs by plan.
- **Code Connect** is Organization/Enterprise only, and is driven by the Figma CLI rather than by documented REST endpoints. The `file_code_connect:write` scope is referenced on the plan-access-tokens page but does not appear in the published scopes table — see the gaps section of the API doc.

---

## 3. Full OAuth scope list

Verbatim from <https://developers.figma.com/docs/rest-api/scopes/>. 24 scopes.

| Scope | What it unlocks | Plan / role note |
| --- | --- | --- |
| `current_user:read` | Read your name, email, and profile image (`GET /v1/me`) | |
| `file_comments:read` | Read the comments for files | |
| `file_comments:write` | Post and delete comments and comment reactions in files | |
| `file_content:read` | Read the contents of files, such as nodes and the editor type | |
| `file_dev_resources:read` | Read dev resources in files | |
| `file_dev_resources:write` | Write dev resources to files | |
| `file_metadata:read` | Read metadata of files (also gates oEmbed) | |
| `file_variables:read` | Read variables in files | **Enterprise plan only** |
| `file_variables:write` | Write variables and collections in files | **Enterprise plan only** |
| `file_versions:read` | Read the version history for files you can access | |
| `files:read` | **Deprecated.** Read files, projects, users, versions, comments, components, styles, and webhooks | Deprecated — see below |
| `library_analytics:read` | Read your design system analytics | **Enterprise plan only** |
| `library_assets:read` | Read data of individual published components and styles | |
| `library_content:read` | Read published components and styles of files | |
| `org:activity_log_read` | Read organization activity logs | **Enterprise only. Must be an org admin** |
| `org:ai_metering_usage_read` | Read organization AI usage | **Enterprise only. Must be an org admin** |
| `org:developer_log_read` | Read organization developer logs | **Enterprise + Governance+. Must be an org admin** |
| `org:discovery_read` | Read text event data in the organization | **Enterprise + Governance+. Must be an org admin** |
| `project_metadata:read` | Read metadata of projects | |
| `projects:read` | List projects and files in projects | |
| `selections:read` | Read most recent selection in files you can access | ⚠️ **no documented endpoint consumes this** |
| `team_library_content:read` | Read published components and styles of teams | |
| `webhooks:read` | Read metadata of webhooks | |
| `webhooks:write` | Create and manage webhooks | |

**On `files:read`:** it still works, but Figma says it is "extremely permissive" and "highly recommended you use the granular scopes." The OpenAPI spec reflects the transition — most read endpoints accept *either* their granular scope *or* `files:read`. **`cyber-figma` should request granular scopes only.** Separately, the older `file_read` scope is deprecated for OAuth 2 tokens.

**On the Figma MCP Server:** Figma ships its own MCP server. Per the scopes page, it "handles its own OAuth authentication flow — you don't configure REST API scopes for it," and access is limited to clients listed in the Figma MCP Catalog (waitlist for new clients). This is worth knowing because `cyber-figma`'s local MCP server is a *different* thing: a REST-API wrapper using REST-API credentials, not a client of Figma's MCP server.

---

## 4. Rate limits

Effective **17 November 2025**. Figma uses a **leaky bucket** algorithm; exceeding the bucket returns `429`.

Limits are determined by three factors: **the seat type of the user**, **the rate-limit tier of the endpoint**, and **the plan the requested resource lives in**.

### Quota table

Rates are per minute unless stated. In the Starter column the value spans both seat rows — i.e. **on Starter, Dev/Full seats get the same quota as View/Collab.**

| Tier | Seat | Starter | Professional | Organization | Enterprise |
| --- | --- | --- | --- | --- | --- |
| **Tier 1** | View, Collab | Up to 6/month | Up to 6/month | Up to 6/month | Up to 6/month |
| | Dev, Full | *(up to 6/month)* | **10/min** | **15/min** | **20/min** |
| **Tier 2** | View, Collab | Up to 5/min | Up to 5/min | Up to 5/min | Up to 5/min |
| | Dev, Full | *(up to 5/min)* | **25/min** | **50/min** | **100/min** |
| **Tier 3** | View, Collab | Up to 10/min | Up to 10/min | Up to 10/min | Up to 10/min |
| | Dev, Full | *(up to 10/min)* | **50/min** | **100/min** | **150/min** |

For View and Collab seats the figures are ceilings, not guarantees: *"Depending on traffic and demand, the actual limit may be lower. For example, a user with a View seat who tries to query a Tier 1 endpoint might only be able to make 2 requests in a month."*

### Which endpoints are in which tier

| Tier | Endpoints |
| --- | --- |
| **Tier 1** (most expensive) | `GET file`, `GET file nodes`, `GET image` |
| **Tier 2** | Comments · Dev Resources · Discovery · `GET image fills` · `GET team projects` · `GET project files` · `GET local variables` · `GET published variables` · Version History · Webhooks |
| **Tier 3** (cheapest) | Activity Logs · Components & Styles · Developer Logs · `GET file metadata` · Library Analytics · Payments · `GET project metadata` · Users · **`POST variables`** |

Two non-obvious placements: **`POST variables` (a write) is Tier 3**, cheaper than reading variables; and **`GET file metadata` is Tier 3** while `GET file` is Tier 1 — so metadata-first listing flows are ~15× cheaper than fetching documents.

**The Tier 1 / View-seat cliff is the headline risk:** a Viewer or Collab seat gets **6 `GET file` calls per month**, on every plan including Enterprise. Any tool whose primary flow is "read a file" is unusable for those seats. `cyber-figma` should detect this from the `429` headers and say so explicitly rather than appearing broken.

### How limits are counted per auth mode

| Auth mode | Counted per |
| --- | --- |
| **OAuth app** | per-user, **per-plan, per-app** — each app gets its own budget, so one noisy app cannot starve another |
| **Plan access token** | **per-token**, per-plan — each token is tracked separately, so you can isolate workloads by minting separate tokens |
| **Personal access token** | **per-user**, per-plan — *every* script sharing one PAT shares one budget |

Figma's own example: a team sharing one person's PAT to run a script gets rate-limited collectively, because all requests count against the token owner.

### 429 handling

`429` responses carry:

| Header | Type | Meaning |
| --- | --- | --- |
| `Retry-After` | integer | Seconds to wait before retrying |
| `X-Figma-Plan-Tier` | enum | `enterprise` \| `org` \| `pro` \| `starter` \| `student` |
| `X-Figma-Rate-Limit-Type` | enum | `low` (Collab/Viewer seats) \| `high` (Full/Dev seats) |
| `X-Figma-Upgrade-Link` | string | A `/pricing` or `/settings` URL to surface to the user |

Figma's prescribed mitigations: **batch** (one `GET images` call listing many node IDs, not one call per image), **cache**, honor `Retry-After` with backoff, and **surface `X-Figma-Upgrade-Link`** to users whose seat is the actual constraint.

The Discovery API is the one documented exception to the tier model: its own error table describes `429` as *"more than 20 per second"*.

---

## 5. Auth modes compared

| | Personal access token | Plan access token | OAuth 2 app |
| --- | --- | --- | --- |
| **Plan required** | none | **Organization or Enterprise only** | none |
| **Tied to** | the individual user | the plan (no user) | the individual user, via your app |
| **Header** | `X-Figma-Token: <token>` | `X-Figma-Token: <token>` | `Authorization: Bearer <token>` |
| **Max expiration** | **90 days** | **365 days** | access token **90 days**, refreshable |
| **Rotation** | none — regenerate manually | **Refresh** supported; old secret works 24 h | refresh token, reusable indefinitely |
| **Scoped** | yes, chosen at creation | yes, plus a **resource allowlist** | yes, chosen per app + per authorize call |
| **Least privilege** | ✗ — can reach anything the user can | ✓ — plan-scoped, resource-scoped | ✓ |
| **Who creates it** | any user | **org admin with MFA** | app developer; user consents |
| **Setup cost** | trivial | admin involvement | callback server + review flow |
| **Survives offboarding** | ✗ dies with the user | ✓ | ✓ (admins can reassign) |
| **Revocation** | instant, from Settings → Security | instant, cannot be undone | via app |

### Personal access tokens

Created at Settings → Security → *Generate new token*; you set expiration and scopes at creation. **Shown once.** From that screen you can see each token's scopes and its last-used time (approximate, "give or take a few minutes"), and revoke instantly.

**Max expiration is 90 days** — note this figure is *not* stated on the personal-access-tokens page itself; it comes from the comparison table on the plan-access-tokens page, independently corroborated by community reports. The **maximum number of PATs per account is undocumented**, the selectable expiry options below 90 days are undocumented, and there is **no automatic rotation**.

History worth knowing: a **"No expiration" option previously existed and was removed** as a security change. The 90-day ceiling is therefore relatively recent, and the resulting rotation burden on CI/CD pipelines is a live, well-attested community complaint that Figma has acknowledged as a feature request without committing to it. ([forum thread](https://forum.figma.com/suggest-a-feature-11/extended-no-expiration-personal-access-tokens-40595)) Plan for rotation; do not expect a non-expiring token to become available.

⚠️ Per the file-endpoints error table, **an expired token presents as `403`, not `401`** — so expiry must be handled in the 403 path, not alongside authentication failures.

### Plan access tokens

Generally available since **23 July 2026**. Created by org admins at <https://www.figma.com/developers/tokens>. Creation **requires MFA** on the admin's account, unless the org enforces "Members must log in with SSO."

Two categories:
- **REST API tokens** — customizable scopes, plus a resource choice of *All resources* or *Only selected resources* (a list of file/project/team/workspace links).
- **Figma CLI tokens** — a fixed scope set for Code Connect and codebase uploads. Not general-purpose.

**Endpoints plan tokens cannot reach** — this is the important limitation:
- anything requiring `file_code_connect:write`
- anything requiring **`file_variables:write`** (so: no `POST variables`)
- anything requiring **`file_comments:write`** (so: no posting/deleting comments or reactions)
- **`/v1/me`**
- **`/v1/oembed`**

So a plan token is an excellent *read/automation* credential and cannot be the only credential for a tool that writes comments or variables.

**Refresh behavior:** refreshing an active (non-revoked, non-expired) token recomputes expiry as *today + the original lifetime* (e.g. +30 or +90 days), and **the previous secret keeps working for 24 hours** — a genuine zero-downtime rotation window. Revocation is immediate and irreversible; a revoked token must be replaced by a new one with the same scopes and resource access re-selected.

### OAuth 2

Authorization-code flow only (`response_type=code`), PKCE supported with **S256 only**. Apps start in **draft** (testable only by you and plan admins), then publish as **private** (your team/org, no review) or **public** (Figma review required). Since the 2025-09-23 platform update, all OAuth apps must complete the publishing flow to stay active.

- **Auth codes expire 30 seconds after issue** — the exchange must be immediate and server-side.
- **Access tokens expire after 90 days** by default; `expires_in` is returned in seconds.
- A refresh token can be reused as many times as needed. **Figma stores only one access token per app per user**, so refreshing immediately invalidates the previous access token — a client that keeps stale tokens around will break itself.
- The refresh response returns **no new refresh token** — keep the original.
- Use `user_id_string`, not the deprecated numeric `user_id`: Figma user IDs look numeric but do not all fit in a JavaScript number or a Go `float64`.
- The authorize URL must be opened in a **real browser — WebView is unsupported**.
- **Required for Activity Logs, Discovery, and the Embed API**; the Activity Logs flow specifically needs an org admin to authorize with scope `org:activity_log_read`.
- Government: `https://api.figma-gov.com/v1/oauth/token`.

---

## 6. Recommendation for `cyber-figma`

**Default to a personal access token via `FIGMA_ACCESS_TOKEN`, with `--token` for per-invocation override** — mirroring `cyber-asana`'s `ASANA_ACCESS_TOKEN`/`--token` convention.

Why:

- It is the only mode that covers the **entire endpoint surface** the tool would plausibly wrap. Plan tokens cannot write comments or variables and cannot call `/v1/me`; OAuth cannot call Payments at all.
- It works on **every plan**, including Starter and Professional, where an agent CLI is most likely to be used casually.
- It requires no callback server, no app registration, and no Figma review — appropriate for a local CLI and a local MCP server, which are exactly the "scripts and local tooling" case Figma names for PATs.
- The `X-Figma-Token` header is a single static header, so the client stays trivial.

Design around its two real weaknesses:

1. **Shared-budget rate limiting.** A PAT's quota is per-user, so every process using it competes. Ship `Retry-After`-aware retry with exponential backoff from day one, and surface `X-Figma-Rate-Limit-Type` and `X-Figma-Upgrade-Link` in the error message so a user hitting the View-seat 6/month wall understands *why*.
2. **90-day expiry with no rotation.** Treat expiry as a normal, expected error state, not an exceptional one. Because Figma reports it as a **`403`**, the 403 handler must distinguish "your token expired — generate a new one" from "you lack permission on this resource"; collapsing both into one message is the difference between a 10-second fix and a support ticket.

**Support plan access tokens as a first-class second mode** (same `X-Figma-Token` header, so it costs almost nothing to add) for CI and org automation, and **explicitly document the five things plan tokens cannot do**. A connection-check command must not rely on `/v1/me` in this mode, since plan tokens cannot call it — fall back to something like `GET file meta` against a configured file.

**Defer OAuth 2.** It is the right choice for a hosted multi-user product, and it is *required* if Activity Logs or Discovery are ever in scope, but it demands a callback server and an app-review lifecycle that a local CLI should not carry. Note the asymmetry when scoping later work: Activity Logs and Discovery need OAuth (or, for Activity Logs, a plan token) and will never work with a PAT.

Config surface implied by all of the above: `FIGMA_ACCESS_TOKEN` (required), `FIGMA_TEAM_ID` (required for team-scoped commands — Figma provides **no way to discover a team ID from a token**), and an optional auth-mode hint so the tool can give precise "not available with this token type" errors instead of relaying bare 403s.

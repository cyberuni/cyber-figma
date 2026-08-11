---
title: Plans and limits
description: What Figma's plan tiers, seat types, and rate limits actually gate — and the trap that makes a paid plan behave like a free one.
sidebar:
  order: 1
---

Most "the Figma API is broken" reports are really plan, seat, or token questions. This page
is the reference for all three.

:::caution[Figma changes these numbers]
Figma states directly: *"Figma reserves the right to change rate limits. Changes may affect
specific endpoints, tiers, or plans."* The limits below took effect **17 November 2025**.
Do not treat any figure here as permanent.
:::

## Access is an intersection

Whether a given call succeeds depends on **four** things, not one:

1. **The plan tier of the resource being requested** — Starter, Professional, Organization,
   Enterprise, plus Government and the Governance+ add-on on Enterprise.
2. **The seat type of the user** — View, Collab, Dev, Full. This determines rate limits,
   and it is the axis most people miss.
3. **The auth mode** — personal access token, plan access token, or OAuth 2. Each supports
   a *different subset of endpoints*. See [Authentication](/cyber-figma/authentication/).
4. **The scopes on the token**, which never exceed the user's actual Figma permissions:
   *"Scopes do not supersede the permissions granted to you by an organization or the owner
   of a project, team, or file."*

The consequence that catches people: **a personal access token is tied to your whole
account, not to a plan.** If you hold a Full seat in an Enterprise org but also have files
in a Starter plan, requests against the *Starter* files get Starter limits. The limit
follows the plan **the resource lives in**, not the best plan you belong to.

### The Starter-context trap

:::danger[A paid plan can silently behave like a free one]
A documented field case: a **Professional-plan user with a Full seat** received
`X-Figma-Rate-Limit-Type: low` and a `Retry-After` of **roughly 4.5 days** from the Images
endpoint — apparently Viewer-tier treatment on a paid plan.

The cause was not the API. An imported `.fig` file had been placed back under the user's
**free account**, so the resource lived in a Starter context. Moving it into the Pro team
restored `high` limits.
:::

There is no error message for this. The only visible signal is the `429` header set — a
`X-Figma-Plan-Tier` of `starter` on what you believe is a paid workspace, or a
`X-Figma-Rate-Limit-Type` of `low` on a Full/Dev seat. `cyber-figma` is designed to surface those headers verbatim and to name
file location as a likely cause, because a multi-day `Retry-After` otherwise looks like an
outage.

Source: [REST API rate limits: Pro plan with Full seat still getting `low` and multi-day Retry-After](https://forum.figma.com/report-a-problem-6/rest-api-rate-limits-pro-plan-with-full-seat-still-getting-x-figma-rate-limit-type-low-and-multi-day-retry-after-51333)
(Figma community forum).

## What each plan gates

`—` means no plan gate is documented; access is governed by ordinary file and project
permissions plus seat-based rate limits.

| Endpoint group | Minimum plan | Seat / role requirement |
| --- | --- | --- |
| Files — `GET file`, `file nodes`, `images` | — | any, but View/Collab are throttled to ~6/month |
| Files — `GET image fills`, `GET file meta` | — | any |
| Version history | — | any |
| Projects — team projects, project files, project metadata | — | any |
| Comments — read | — | any |
| Comments and reactions — write, delete | — | must be able to comment; **only the author may delete** |
| Users — `GET /v1/me` | — | any |
| Components / component sets / styles | — | any |
| Webhooks v2 — read | — | see the creator rules below |
| Webhooks v2 — write | — | team admin, or project/file editor per context |
| Dev Resources — read | — | any; surfaced in Dev Mode |
| Dev Resources — write | — | edit access |
| **Variables — read** | **Enterprise** | any org member with View access; **guests excluded** |
| **Variables — write** | **Enterprise** | **Full seat or admin**, with Edit access on the file |
| **Library Analytics** (6 endpoints) | **Enterprise** | any user with a seat in the Enterprise plan |
| **Activity Logs** | **Enterprise** | **org admin only** |
| **Developer Logs** | **Enterprise + Governance+** | **org admin only** |
| **AI Usage** | **Enterprise** | **org admin** — only admins can mint the required plan token |
| **Discovery** | **Enterprise + Governance+** | **org admin only** |
| Payments | — | must **own** the plugin, widget, or Community file |
| oEmbed | — | any |
| SCIM (a separate API) | **Organization** — not Starter or Professional | org admin |

### The Enterprise-only set

Six endpoint groups are Enterprise-only. In a CLI or MCP wrapper these should degrade with
an explicit "requires an Enterprise plan" message rather than relaying a bare `403`:

1. **Variables** — read *and* write. Read being Enterprise-gated surprises people; only
   *write* additionally requires a Full seat.
2. **Library Analytics**
3. **Activity Logs** — plus org admin
4. **Developer Logs** — plus the Governance+ add-on, plus org admin
5. **AI Usage** — plus org admin
6. **Discovery** — plus the Governance+ add-on, plus org admin

**Governance+** is an Enterprise add-on and gates exactly two of these: Developer Logs and
Discovery.

### Dev Mode

The **Dev Resources REST endpoints carry no documented plan gate** — they behave like
ordinary file-permission-scoped endpoints. What *is* gated is the Dev Mode product surface
those resources appear in. Per Figma's help center (a help-center page, not a developer-docs
page): Dev Mode is available on **all paid plans** and requires a **Full or Dev seat**.

Two consequences:

- The **`Completed`** Dev Mode status is Organization/Enterprise only; `Ready for dev`
  exists on every plan that provides Dev Mode. This bears on the
  `DEV_MODE_STATUS_UPDATE` webhook event — the set of statuses that can fire it differs by
  plan.
- **Code Connect** is Organization/Enterprise only, and is driven by the Figma CLI rather
  than by documented REST endpoints.

Source: [Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode).

### Webhook count limits

Webhooks are not plan-gated to create, but the counts are capped: **20 per team, 5 per
project, 3 per file**. Total *file* webhooks per plan: Professional **150**, Organization
**300**, Enterprise **600**.

## Rate limits

Figma uses a **leaky bucket** algorithm; exceeding the bucket returns `429`. Limits are
determined by three factors: the **seat type** of the user, the **rate-limit tier** of the
endpoint, and the **plan the requested resource lives in**.

### Quota table

Rates are per minute unless stated. In the Starter column the value spans both seat rows —
that is, **on Starter, Dev and Full seats get the same quota as View and Collab.**

| Tier | Seat | Starter | Professional | Organization | Enterprise |
| --- | --- | --- | --- | --- | --- |
| **Tier 1** | View, Collab | Up to 6/month | Up to 6/month | Up to 6/month | Up to 6/month |
| | Dev, Full | *(up to 6/month)* | **10/min** | **15/min** | **20/min** |
| **Tier 2** | View, Collab | Up to 5/min | Up to 5/min | Up to 5/min | Up to 5/min |
| | Dev, Full | *(up to 5/min)* | **25/min** | **50/min** | **100/min** |
| **Tier 3** | View, Collab | Up to 10/min | Up to 10/min | Up to 10/min | Up to 10/min |
| | Dev, Full | *(up to 10/min)* | **50/min** | **100/min** | **150/min** |

For View and Collab seats these are **ceilings, not guarantees**: *"Depending on traffic
and demand, the actual limit may be lower. For example, a user with a View seat who tries
to query a Tier 1 endpoint might only be able to make 2 requests in a month."*

:::caution[The Tier 1 / View-seat cliff]
A Viewer or Collab seat gets **6 `GET file` calls per month** — on every plan, including
Enterprise. Any tool whose primary flow is "read a file" is unusable for those seats.
`cyber-figma` reads this off the `429` headers and says so, rather than appearing broken.
:::

### Which endpoints are in which tier

| Tier | Endpoints |
| --- | --- |
| **Tier 1** (most expensive) | `GET file` · `GET file nodes` · `GET image` |
| **Tier 2** | Comments · Dev Resources · Discovery · `GET image fills` · `GET team projects` · `GET project files` · `GET local variables` · `GET published variables` · Version history · Webhooks |
| **Tier 3** (cheapest) | Activity Logs · Components & Styles · Developer Logs · `GET file metadata` · Library Analytics · Payments · `GET project metadata` · Users · **`POST variables`** |

Two placements are counter-intuitive and worth designing around:

- **`POST variables` is Tier 3** — a write, cheaper than *reading* variables.
- **`GET file metadata` is Tier 3 while `GET file` is Tier 1**, so a metadata-first listing
  flow is roughly 15× cheaper than fetching documents.

The Discovery API is the one documented exception to the tier model: its own error table
describes `429` as *"more than 20 per second"*.

### How limits are counted per auth mode

| Auth mode | Counted per |
| --- | --- |
| **OAuth app** | per user, per plan, **per app** — each app gets its own budget, so one noisy app cannot starve another |
| **Plan access token** | **per token**, per plan — mint separate tokens to isolate workloads |
| **Personal access token** | **per user**, per plan — *every* script sharing one PAT shares one budget |

Figma's own example: a team sharing one person's personal access token to run a script gets
rate-limited collectively, because all requests count against the token owner.

### Reading a 429

| Header | Type | Meaning |
| --- | --- | --- |
| `Retry-After` | integer | Seconds to wait before retrying |
| `X-Figma-Plan-Tier` | enum | `enterprise` \| `org` \| `pro` \| `starter` \| `student` |
| `X-Figma-Rate-Limit-Type` | enum | `low` (Collab/Viewer seats) \| `high` (Full/Dev seats) |
| `X-Figma-Upgrade-Link` | string | A `/pricing` or `/settings` URL to show the user |

Figma's prescribed mitigations: **batch** (one `GET images` call listing many node IDs
rather than one call per image), **cache**, honor `Retry-After` with backoff, and **surface
`X-Figma-Upgrade-Link`** to users whose seat is the actual constraint.

### Diagnosing a surprising 429

| Symptom | Most likely cause |
| --- | --- |
| `X-Figma-Rate-Limit-Type: low` on a Full or Dev seat | The **resource** lives in a Starter context — see [the trap above](#the-starter-context-trap) |
| `X-Figma-Plan-Tier: starter` on a paid workspace | Same — check where the file actually sits |
| Multi-day `Retry-After` | A Tier 1 endpoint against a View/Collab quota, which is monthly |
| Limits hit far sooner than the table suggests | The View/Collab figures are ceilings, and the budget is shared across every process using the same PAT |
| `403` rather than `429` | Not a limit at all — the token may be **expired**; Figma reports expiry as `403` |

## Sources

- [Rate limits](https://developers.figma.com/docs/rest-api/rate-limits/)
- [Scopes](https://developers.figma.com/docs/rest-api/scopes/)
- [Authentication](https://developers.figma.com/docs/rest-api/authentication/)
- [Personal access tokens](https://developers.figma.com/docs/rest-api/personal-access-tokens/)
- [Plan access tokens](https://developers.figma.com/docs/rest-api/plan-access-tokens/)
- [Variables](https://developers.figma.com/docs/rest-api/variables/)
- [Library Analytics](https://developers.figma.com/docs/rest-api/library-analytics-intro/)
- [Activity Logs](https://developers.figma.com/docs/rest-api/activity-logs/)
- [Developer Logs](https://developers.figma.com/docs/rest-api/developer-logs/)
- [AI Usage](https://developers.figma.com/docs/rest-api/ai-usage/)
- [Discovery](https://developers.figma.com/docs/rest-api/discovery-endpoints/)
- [Webhooks](https://developers.figma.com/docs/rest-api/webhooks/)
- [SCIM](https://developers.figma.com/docs/rest-api/scim/)
- [Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) (help center)

:::note[How this was verified]
Figma's quota table carries its meaning in HTML `rowspan` attributes, which markdown or
text conversion silently drops — shifting every Dev/Full figure one plan-tier to the left.
The table above was verified against the **raw HTML** of two independently authored
official pages.
:::

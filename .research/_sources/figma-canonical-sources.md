# Figma — canonical sources

Shared source registry for Figma research topics (`figma-rest-api-surface`, `figma-plans-and-limits`).

## Primary sources

| Source | URL | Type | Why it matters |
| --- | --- | --- | --- |
| OpenAPI specification | <https://github.com/figma/rest-api-spec> | machine-readable spec | The only complete, structured description of the API. **Self-labelled beta** — accurate enough to be the backbone, not accurate enough to trust alone. Parse it; do not read it prose-first. |
| `@figma/rest-api-spec` (npm) | <https://registry.npmjs.org/@figma/rest-api-spec> | package registry | Cheapest staleness check. The `latest` version is the recheck trigger for the surface topic. |
| REST API docs | <https://developers.figma.com/docs/rest-api/> | official prose | Carries material the spec omits entirely (Discovery, plan gating, rate limits). Note `www.figma.com/developers/api` now 301s here. |
| REST API changelog | <https://developers.figma.com/docs/rest-api/changelog/> | official prose | Watchlist for new endpoint groups; cadence has been roughly quarterly. |

## Corrective sources

| Source | URL | Type | Why it matters |
| --- | --- | --- | --- |
| `figma/rest-api-spec` issues | <https://github.com/figma/rest-api-spec/issues> | issue tracker | The angle that reveals where the primary source is **wrong**. Small enough (~29 open) to review fully. |
| Figma community forum | <https://forum.figma.com/> | practitioner reports | How documented behavior actually presents in the field, and which failures get misdiagnosed. |
| Figma help center | <https://help.figma.com/> | official prose (product) | Product/packaging gating (Dev Mode, seats) that the developer docs do not cover. Changes more often than developer docs — treat as medium confidence. |

## Watchlist

- **`@figma/rest-api-spec` version > 0.41.0** — primary staleness signal for the endpoint inventory.
- **The rate-limits page** — Figma explicitly reserves the right to change limits; current table effective 2025-11-17.
- **Spec issues #86 (number vs integer), #81 (missing `err`), #28 (analytics param name)** — open and still reproducing as of 2026-08-11.
- **Plan access token capabilities** — if they gain `file_comments:write` / `file_variables:write` / `/v1/me`, the default-auth recommendation changes.
- **Enterprise-gated domains** — Variables, Library Analytics, Activity Logs, Developer Logs, AI Usage, Discovery. Any moving down-tier widens the addressable feature set.

## Method notes

Two traps found the hard way, both worth repeating on any update:

1. **Parse HTML tables structurally, never from rendered text.** The rate-limit quota table's meaning lives in `rowspan` attributes. Markdown/text conversion silently drops them and shifts values a column left, producing a plausible but wrong table. Two independent summarization attempts made exactly this error.
2. **Re-verify every reported defect against the pinned spec version.** Figma fixes spec bugs without closing issues, so the open-issue list overstates current defects (issue #30 no longer reproduces). Record issue status and verification status separately.

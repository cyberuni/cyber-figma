# Fleet run — initial build of cyber-figma

How this repo got built, what landed, and what is still open. Written at the
point the build was paused, so a later session can resume without the original
transcript.

Paused: 2026-08-11. Tree state at pause: `pnpm verify` exits 0, 72 commits on
`main`, nothing uncommitted.

## What this repo is

`cyber-figma` wraps the Figma REST API as three surfaces that share one core:
an agent-friendly CLI, a local MCP server, and an agent plugin. It is a
deliberate near-clone of the sibling project `cyberuni/cyber-asana` — same
monorepo shape, same Screaming Architecture, same agent-CLI principles. When a
question here has no answer, the answer is usually "whatever cyber-asana does".

## How it was built

Thirteen agents in four waves, each in its own git worktree, all pushing to
`main` with rebase-on-reject.

| Wave | Agent | Scope |
| --- | --- | --- |
| 1 | `figma-api-research` | Figma REST inventory + plan/seat/scope gating → `docs/research/` |
| 1 | `figma-scaffold` | monorepo, biome/turbo/knip/changesets/husky, CI workflows, AGENTS.md |
| 2 | `figma-core` | the spine: client, auth, errors, pagination, output, CLI/MCP entrypoints, test doubles |
| 2 | `figma-plugin` | six plugin manifests, marketplace entry, version sync, three skills |
| 2 | `figma-web` | Astro docs site: landing, install, auth, plans-and-limits, coverage |
| 3 | `figma-d-files` | Files ×6 |
| 3 | `figma-d-comments` | Comments ×3 + reactions ×3 |
| 3 | `figma-d-projects` | Projects ×3, Users, oEmbed |
| 3 | `figma-d-library` | Components / component sets / styles ×9 |
| 3 | `figma-d-webhooks` | Webhooks v2 ×7 |
| 3 | `figma-d-devresources` | Dev Resources ×4 |
| 3 | `figma-d-variables` | Variables ×3 (Enterprise) |
| 3 | `figma-d-analytics` | Library Analytics ×6, Activity/Developer Logs, AI Usage, Discovery, Payments |

Per-domain endpoint detail — what each covered, skipped, and why — is in
[`coverage-log.md`](./coverage-log.md), written by the pods themselves.

### What worked, for the next run

- **The spine-then-domains split.** `figma-core` wrote
  [`src/README-for-domain-pods.md`](../packages/cyber-figma/src/README-for-domain-pods.md)
  — a worked skeleton plus a traps list — and eight domain pods then built
  against it in parallel without coordinating. That file is the reason they
  agreed on structure. Keep it current; it is the contract.
- **Naming the one shared edit up front.** Every domain must add a line to
  `composition.ts` and `index.ts`. Both lists are purely additive, so each pod
  was told the rebase conflict was expected and to resolve it by keeping *both*
  sides, never by dropping a sibling's line. Eight concurrent writers, no lost
  registrations.
- **Research before code, as a committed artifact.** `docs/research/` was
  written first and every later pod was pointed at it as the source of truth
  with "do not invent API facts; add them there with a source link instead".

### What did not work

- **Agent-to-agent mail was unreliable.** Of thirteen pods, one message
  arrived, and its body was the sender's own send-script rather than a report.
  Reporting was moved into the repo (`coverage-log.md`) and that worked. Treat
  git as the ledger; do not build a run that depends on mail.
- **Dispatch preceded registration.** The first two pods were spawned before the
  dispatcher had registered a mailbox, so they had no return address at all.
  Register first.

## State at pause

- 15 resource domains wired in `composition.ts` (`library` registers as a spread,
  `...LIBRARY_DOMAINS`, because it splits into component / component-set / style).
- ~37 MCP tools, `figma_<resource>_<action>`.
- 988 tests across 89 files; 16 acceptance-spec factories; 15 system suites, all
  gated behind `FIGMA_SYSTEM_TEST` and skipping cleanly when unset.
- 8 changesets queued in `.changeset/`. **Nothing has been published to npm yet.**
- The docs site builds; its CLI and MCP reference pages are marked placeholders.

## NEXT

Ordered by what unblocks the most.

1. **Wave 4 — docs reference pages.** `apps/web` still has placeholder CLI and
   MCP reference sections, and its API-coverage table still marks every domain
   as planned. All 15 domains have now landed, so both need filling in from what
   actually shipped. Structure and nav are already in place for this.
2. **First publish.** 8 changesets are queued and unreleased. Decide the initial
   version, run the release workflow, and confirm the plugin tarball is complete
   — `npm pack --dry-run` must show every path in `packages/cyber-figma`'s
   `files` array, or the plugin will not reach consumers.
3. **Live verification.** No system suite has ever run against a real Figma
   account. Everything is verified against doubles only. Run
   `FIGMA_SYSTEM_TEST=1 FIGMA_ACCESS_TOKEN=<pat> pnpm cf test:system` and expect
   to find real drift — this is the single largest correctness risk in the repo.
4. **The Enterprise gap — read this before trusting those domains.** Variables,
   Library Analytics, Activity Logs, Developer Logs, AI Usage, and Discovery are
   Enterprise-gated, and three are org-admin-only. They were built entirely
   against doubles derived from documentation, by pods that could not call the
   real endpoints even once. Their request shapes are unproven. Do not treat
   them as equally trustworthy to the ungated domains, and say so in the docs
   until someone verifies them on an Enterprise org.
5. **Rate limits are a real hazard when testing Files.** `GET file`,
   `GET file nodes`, and `GET images` are Figma's costliest tier, and a View or
   Collab seat gets roughly 6 calls *per month* on every plan. A careless system
   run can exhaust a month's quota. Prefer `GET file meta` (tier 3) for
   exploration.
6. **GitHub repo settings.** Branch protection, required checks, and the Pages
   source for `deploy-docs.yml` have not been configured.

## Resuming

Read, in order: this file → `AGENTS.md` → `docs/research/figma-rest-api.md`
("Known spec defects" and "Pagination models" first) →
`src/README-for-domain-pods.md`. Then `pnpm install && pnpm verify` to confirm
the tree is still green before changing anything.

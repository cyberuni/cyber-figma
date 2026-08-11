---
name: inspect-figma-file
description: Use this skill when reading a Figma file's structure — pages, frames, components, or one node — without wasting quota.
---

# Inspect Figma File

## When to use

When the user points at a Figma file or a specific frame and wants to know what is in it — page and frame structure, a node's properties, published components or styles, or which file a URL refers to.

Not for exporting images — use **export-figma-assets** for that.

## Ensure cyber-figma CLI

See the **Ensure cyber-figma CLI** section of the **init-figma** skill. If `FIGMA_ACCESS_TOKEN` is unset, run **init-figma** first.

If a command below exits `2` (usage error), the spelling has moved — confirm it with `cyber-figma --help` and `cyber-figma <resource> --help` rather than guessing. The global flags (`--token`, `--team`, `--toon`, `--json`, `--full`) and the exit codes are stable.

## The one rule that matters

`GET file` is the single most expensive call in the Figma API (rate-limit tier 1), it is **not paginated**, and it returns the *entire* document tree. On a View or Collab seat the whole month's budget is about **6 such calls**. So:

**Never fetch the full tree first. Narrow before you fetch.**

The ladder, cheapest first:

| Step | Command | Tier | Returns |
| --- | --- | --- | --- |
| 1 | `file meta` | 3 | name, project folder, last touched, editor type, role |
| 2 | `file get --depth 1` | 1 | pages only |
| 3 | `file get --depth 2` | 1 | pages + top-level objects |
| 4 | `node get --ids <ids>` | 1 | just the named subtrees |
| 5 | `file get` (no flags) | 1 | everything — last resort |

## Instructions

### 1. Resolve the file key (and node id) from the URL

Figma URLs carry both:

```
https://www.figma.com/design/<file-key>/<title>?node-id=<node-id>
```

The segment after `/design/` (or the older `/file/`) is the file key. `?node-id=` is a specific node — if the user's link has one, they are almost certainly asking about *that* node, not the whole file. Say so and go straight to step 4.

Note that `node-id` in a URL is dash-separated (`12-345`) while the API uses a colon (`12:345`). Pass the URL through the CLI rather than hand-editing it where possible.

### 2. Start with metadata

```bash
cyber-figma file meta <file-key> --toon
```

Cheap (tier 3), and it answers "what is this file, when did it change, what access do I have" — often the whole question. `version` and `last_touched_at` are also the cheap way to check whether anything changed since a previous run.

(`--toon` is the token-efficient format; use `--json` for raw JSON.)

### 3. Map the structure with depth, not with everything

```bash
cyber-figma file get <file-key> --depth 1 --toon   # pages
cyber-figma file get <file-key> --depth 2 --toon   # pages + top-level frames
```

Read the node ids out of that output and use them in the next step. Do not go deeper than needed — `depth` is what keeps a large file from returning a payload that times out. Very large files commonly return `400` or `500` on timeout when fetched whole; that is a size problem, not a bug, and the fix is a narrower request.

### 4. Fetch only the nodes you care about

```bash
cyber-figma node get <file-key> --ids <node-id>[,<node-id>...] --toon
```

Batch every node id you need into **one** call. The response is a map keyed by node id, so a batch costs the same one tier-1 request as a single node.

Node payloads are deep; the CLI truncates large free-text fields by default. Pass `--full` when the user needs the untruncated value.

If the response carries a non-empty `err` field, read it — it names what went wrong. (Figma's own OpenAPI spec omits this field; it is real regardless.)

### 5. Published components and styles

These are separate, much cheaper (tier 3) endpoints, and they return **only published library content** — not every component instance in the file:

```bash
cyber-figma component list --file <file-key> --toon
cyber-figma style list --file <file-key> --toon
```

Two constraints worth stating to the user when the result is empty:

- File-scoped component/style reads require a **main file key, not a branch key** — branches cannot publish.
- An empty result means nothing is *published* from that file, which is not the same as the file containing no components.

For the whole team's library instead of one file, use the team-scoped form (paginated):

```bash
cyber-figma component list --team <team-id> --toon
```

### 6. Comments, when the question is "what did people say"

```bash
cyber-figma comment list <file-key> --toon
```

Tier 2, unpaginated — the full comment list comes back at once.

### 7. Report

Summarize structure in the user's terms — pages, then frames, then the specific node they asked about — rather than pasting raw node JSON. Quote node ids so the user can jump back to them, and name the file and last-modified time so it is clear which version was read.

## When it fails

| Symptom | Likely cause |
| --- | --- |
| `403` on a call that worked before | The token expired — Figma reports expiry as `403`, not `401`. Generate a new one (**init-figma**). |
| `403` on one file only | No access to that file, or the token lacks `file_content:read` / `file_metadata:read`. |
| `429` with a multi-day `Retry-After` | Almost always a View/Collab seat on a tier-1 endpoint (~6 per month), or the file lives in a Starter-plan space. Check `X-Figma-Rate-Limit-Type` (`low` = View/Collab) and `X-Figma-Plan-Tier`, and surface `X-Figma-Upgrade-Link`. |
| `400`/`500` on a whole-file fetch | The file is too large to serialize in time. Re-request with `--depth` or `--ids`. |
| Exit `7` (plan-gated) | The endpoint needs Enterprise. Variables are Enterprise-only **for reads as well as writes**; so are library analytics, activity logs, developer logs, AI usage, and discovery. There is no workaround on a lower plan. |

## References

- [Figma — files endpoints](https://developers.figma.com/docs/rest-api/)
- [Figma — rate limits](https://developers.figma.com/docs/rest-api/rate-limits/)

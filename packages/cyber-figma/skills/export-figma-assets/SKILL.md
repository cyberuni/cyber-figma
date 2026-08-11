---
name: export-figma-assets
description: Use this skill when exporting assets from a Figma file — rendering nodes to PNG/SVG/JPG/PDF, or pulling image fills.
---

# Export Figma Assets

## When to use

When the user wants images out of Figma: icons as SVG, frames as PNG for a doc or a PR, a design as PDF, or the original bitmaps someone dropped into the file.

Not for reading structure — use **inspect-figma-file** for that.

## Ensure cyber-figma CLI

See the **Ensure cyber-figma CLI** section of the **init-figma** skill. If `FIGMA_ACCESS_TOKEN` is unset, run **init-figma** first.

If a command below exits `2` (usage error), the spelling has moved — confirm it with `cyber-figma --help` and `cyber-figma <resource> --help` rather than guessing. The global flags (`--token`, `--team`, `--toon`, `--json`, `--full`) and the exit codes are stable.

## Two different things called "images"

Pick the right one before running anything:

| The user wants | Endpoint family | Command |
| --- | --- | --- |
| Nodes **rendered** to an image (icons, frames, screens) | `GET /v1/images/{file_key}` | `image export` |
| The **original uploaded bitmaps** used as fills in the document | `GET /v1/files/{file_key}/images` | `image fills` |

Rendering is a render job — it produces a new file from the design. Image fills are the source assets a designer imported; rendering will not give you those at original quality.

## Instructions

### 1. Resolve the file key and the node ids

The file key is the segment after `/design/` (or the older `/file/`) in the Figma URL. If the user's link has `?node-id=`, that is the node they mean.

If they described the thing in words ("the icon set", "the checkout screens") rather than linking it, find the ids first with **inspect-figma-file** — `file get --depth 2` lists top-level frames per page. Confirm the list with the user before rendering, since rendering is the expensive part.

### 2. Batch every node into one call

```bash
cyber-figma image export <file-key> \
  --ids <node-id>,<node-id>,<node-id> \
  --format svg \
  --toon
```

**Batching is not an optimization, it is the documented way to avoid rate limits.** Rendering is rate-limit tier 1 — the most expensive tier, roughly 6 calls per *month* on a View or Collab seat. One call listing 50 node ids costs one request; 50 calls cost 50.

Options that matter:

| Flag | Values | Use when |
| --- | --- | --- |
| `--format` | `svg`, `png`, `jpg`, `pdf` | `svg` for icons and anything that must scale; `png` for screenshots and docs; `pdf` for print/handoff |
| `--scale` | `0.01`–`4` | Raster exports at 2x/3x for retina; ignored for `svg` |
| `--use-absolute-bounds` | flag | Text is getting cropped — renders full node dimensions ignoring the crop |
| `--contents-only` | flag | Exclude overlapping content from outside the node |
| `--svg-outline-text` | flag | Render text as vector paths instead of `<text>` — use when the consumer lacks the font |
| `--svg-include-id` / `--svg-include-node-id` | flag | Emit layer name / node id as attributes, for scripts that post-process the SVG |
| `--version` | version id | Export a historical version rather than current |

Images above **32 megapixels** are scaled down rather than rejected.

### 3. Read the response carefully — `null` is not an error

The response is `{ err, images: { <node-id>: <url> | null }, status }`.

**Every requested node id appears as a key, and a `null` value means *that node* failed to render** — a bad id, or nothing renderable in it. It does **not** mean the request failed, and it must **not** be retried as a rate-limit or transient error. Report the null ids back to the user as "these could not be rendered" and move on.

If the call itself returns `400`, the `err` field names which parameter was invalid. Surface that string — it is the most useful diagnostic the API gives, and it is easy to throw away.

### 4. Download before the URLs expire

The returned URLs are temporary:

- **Rendered image URLs expire after 30 days.**
- **Image fill URLs expire after no more than 14 days** — shorter.

So never hand a user a bare URL as the deliverable, and never store one in a repo, a doc, or a task. Download to disk immediately:

```bash
curl -sSL -o <name>.svg '<url>'
```

Ask the user where the files should land and what to name them; derive names from the layer names where they are usable, and say what mapping you used.

### 5. Original image fills

```bash
cyber-figma image fills <file-key> --toon
```

Returns a map of `imageRef` → download URL for every user-supplied image used as a fill. The `imageRef` keys match the `imageRef` values on `Paint` objects in the file's node data, so pair this with **inspect-figma-file** when the user needs to know which fill belongs to which layer. Tier 2 — cheaper than rendering, and unpaginated.

### 6. Report

Tell the user: what was exported, where the files are, which nodes returned `null`, and — if anything was skipped — why.

## When it fails

| Symptom | Likely cause |
| --- | --- |
| Some ids come back `null` | Those nodes have nothing renderable, or the id is wrong. Not a retryable error. |
| `400` with an `err` string | A parameter is invalid — `err` names which one. Common culprits: `scale` outside 0.01–4, a malformed node id. |
| `403` | The token expired (Figma reports expiry as `403`, not `401`), or it lacks `file_content:read`, or there is no access to the file. |
| `429` with a long `Retry-After` | Rendering is tier 1. On a View/Collab seat that is ~6 calls per month on any plan. Check `X-Figma-Rate-Limit-Type` (`low` = View/Collab seat) and `X-Figma-Plan-Tier`; surface `X-Figma-Upgrade-Link`. If the file lives in a personal/Starter space, moving it into the paid team restores the higher limit. |
| A previously working URL now 403s | It expired — re-run the export. Rendered URLs last 30 days, fill URLs at most 14. |

## References

- [Figma — images endpoint](https://developers.figma.com/docs/rest-api/)
- [Figma — rate limits](https://developers.figma.com/docs/rest-api/rate-limits/)

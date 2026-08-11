# Coverage log

What each domain pod shipped, endpoint by endpoint. One section per domain,
alphabetical. Sections are additive — resolve a conflict here by keeping every
side's section.

## files

**Endpoints covered — all six of the Files tag, no skips.**

| Endpoint | Tier | CLI | MCP tool |
| --- | --- | --- | --- |
| `GET /v1/files/{key}` | 1 | `cyber-figma file get <file>` | `figma_file_get` |
| `GET /v1/files/{key}/nodes` | 1 | `cyber-figma file nodes <file> --ids <ids>` | `figma_file_nodes` |
| `GET /v1/images/{key}` | 1 | `cyber-figma file images <file> --ids <ids>` | `figma_file_images` |
| `GET /v1/files/{key}/images` | 2 | `cyber-figma file image-fills <file>` | `figma_file_image_fills` |
| `GET /v1/files/{key}/meta` | 3 | `cyber-figma file meta <file>` | `figma_file_meta` |
| `GET /v1/files/{key}/versions` | 2 | `cyber-figma file versions <file>` | `figma_file_versions` |

Nothing was deliberately skipped.

### How the traps are handled

- **Tier-1 cost.** `get`, `nodes`, and `images` are Figma's costliest tier, and a
  View or Collab seat is allowed roughly 6 tier-1 calls per *month* on every
  plan. `file get` sends `depth=1` (pages only) when the caller narrowed neither
  `--ids` nor `--depth`; `--depth all` is the explicit way to ask for the whole
  tree. Every tier-1 command description and MCP tool description names the cost
  and points at `file meta` (tier 3) for listing and inspection flows.
- **Null renders.** A `null` url in `GET images` means *that node* failed to
  render; the call succeeded and every requested id is present as a key. The api
  returns `{ node_id, url, rendered }` rows plus `failed_node_ids`, and the text
  output says in words that this is a per-node outcome and not a failed call, so
  nothing retries a `null` as an error.
- **Expiring URLs.** Render results carry `url_expires_after_days: 30` and image
  fills `14`; both print an expiry warning in text mode. Neither is presented as
  a stable link.
- **Batching.** `file images` puts every requested id into one `GET /v1/images`
  call — Figma names batching as the primary way to avoid rate limits — and a
  unit test pins that one call is made regardless of id count.
- **Deep trees.** Node payloads are truncated in text mode through
  `truncate(..., { full: isFull() })`, which prints the total size and points at
  `--full`. Names are truncated in tables.
- **`scale` is the one fractional query param.** It goes through `floatParam()`
  so the client's integer coercion does not turn `1.5` into `1`, and a value
  outside 0.01–4 is rejected before the call is spent.
- **Version pagination.** `GET file versions` is the `url_page` model
  (`page_size` + `before`/`after`, answered as full page URLs); it declares that
  spec once, so the CLI flags and MCP params are derived from it.

### Testing without an Enterprise plan

Yes — the whole domain is testable on any plan. None of the six endpoints is
Enterprise-gated; they need only a token that can read the file. The one caveat
is quota rather than plan: the live suite spends tier-1 calls, so it is gated on
`FIGMA_FILE_KEY` and `FIGMA_NODE_ID` on top of `FIGMA_SYSTEM_TEST`, and skips
itself when they are unset.

```sh
FIGMA_SYSTEM_TEST=1 FIGMA_ACCESS_TOKEN=<pat> FIGMA_FILE_KEY=<key> FIGMA_NODE_ID=1-2 pnpm cf test:system
```

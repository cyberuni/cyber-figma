---
'cyber-figma': minor
---

Add the comments domain: `comment list`, `comment create`, `comment delete`, and
`comment reaction list|add|delete`, with the matching `figma_comment_*` and
`figma_comment_reaction_*` MCP tools. Covers all three Comments endpoints and
all three Comment Reactions endpoints.

Comments can be posted as replies (`--reply-to`) and pinned to a point, a frame,
or a region (`--x/--y`, `--node-id`, `--region-width/--region-height`,
`--pin-corner`); `--thread` narrows a listing to one conversation, which Figma's
flat comment list offers no parameter for. Reactions take an emoji shortcode
such as `:heart:` and a literal emoji is refused before the request is spent.
Both deletes are idempotent, and the two rules Figma answers with a bare `403` —
only the author may delete a comment, only the person who reacted may remove a
reaction — are reported as hints. Under `--auth-mode plan` the writes are
refused up front, since Figma does not support `file_comments:write` for plan
access tokens.

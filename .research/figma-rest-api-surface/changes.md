# Figma REST API Surface Changes

## 2026-08-11

- Changed: Initial research recorded. Established the 53-operation surface (50 in the OpenAPI spec v0.41.0 + Discovery + 2 OAuth token endpoints), the four pagination models, the 11-operation mutation set, and the spec-accuracy findings E01–E15.
- Why: `cyber-figma` needs an implementable inventory of the Figma REST API before any domain is built.
- Material conclusion change: yes — first conclusion.
- Trigger: Project brief for the `cyber-figma` research pod.

- Changed: Re-ran the investigation with the deep-research workbench after an initial single-angle pass, adding the spec's issue tracker, endpoint-level docs, and registry metadata as corrective source angles.
- Why: The first pass drew almost exclusively on Figma's own spec and prose docs, with no independent corroboration and no check on whether the primary source was itself accurate.
- Material conclusion change: yes. Three findings that the single-angle pass could not have produced:
  - [E03] 15 numeric parameters across 6 endpoints are typed `number` instead of `integer`, causing real 400s in generated clients — which changes the recommendation from "generate a client" to "hand-write the gateway and coerce integers at the boundary".
  - [E05] `err` is not always null as the spec claims; on a 400 it carries the diagnostic naming the invalid parameter. The earlier pass documented the spec's version and would have discarded the useful field.
  - [E06] An open issue reporting a defect that no longer reproduces, establishing that reported defects must be re-verified against the pinned snapshot rather than trusted.
- Trigger: `figma/rest-api-spec` issues #86, #81, #30, #28, verified against OpenAPI v0.41.0; Figma file-endpoints reference.

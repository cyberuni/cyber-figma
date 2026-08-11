# Figma Plans and Limits Changes

## 2026-08-11

- Changed: Initial research recorded. Established the plan/seat/auth/scope gating model, the rate-limit quota table and tier membership, the six Enterprise-gated domains, token lifecycle per auth mode, and the recommendation to default to personal access tokens (E01–E13).
- Why: `cyber-figma` must choose a default auth mode and produce accurate capability errors rather than relaying bare 403s.
- Material conclusion change: yes — first conclusion.
- Trigger: Project brief for the `cyber-figma` research pod.

- Changed: Corrected the rate-limit quota table. The Starter column's cells carry `rowspan="2"`, so the Starter value spans **both** seat rows and the three Dev/Full values map to Professional, Organization, and Enterprise — not Starter, Professional, Organization.
- Why: Two separate rendered-text summarizations of the rate-limits page produced the shifted (wrong) reading, which would have understated the Starter constraint and misstated every Dev/Full figure by one plan tier.
- Material conclusion change: yes. This is the central quota table; every rate-limit statement in the conclusion depends on it.
- Trigger: Structural HTML parse of the developer-docs rate-limits table, corroborated against the independently authored help-center page carrying identical `rowspan` structure [E02, E03].

- Changed: Added practitioner corroboration for the resource-location rule and for PAT expiry history.
- Why: The single-angle pass asserted both from Figma's docs alone, with no evidence about how they behave in the field.
- Material conclusion change: no — both findings confirmed the documented model. But [E04] identified the most likely support burden (a paid-plan user seeing `low` limits because the file drifted under a free account), and [E09] supplied the history that non-expiring PATs were removed, which the developer docs omit.
- Trigger: Figma community forum threads on rate limits and personal access token expiration.

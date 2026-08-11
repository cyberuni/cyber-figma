---
title: Authentication
description: Figma's three auth modes, the headers and scopes they use, and how cyber-figma picks a credential.
sidebar:
  order: 2
---

Figma offers three ways to authenticate a REST API request, and they are **not
interchangeable** — each one reaches a different subset of the endpoint surface.
`cyber-figma` defaults to a personal access token because it is the only mode that covers
everything the tool plausibly wraps.

## Quick start

```sh
export FIGMA_ACCESS_TOKEN=<your-personal-access-token>
export FIGMA_TEAM_ID=<team-id>   # optional default team
```

Or pass `--token <pat>` and `--team <id>` per command. Both flags override the
corresponding environment variable.

Create the token at **Settings → Security → Generate new token** in Figma. Pick the scopes
you need at creation time — see the [scope table](#oauth-scopes) below.

`FIGMA_TEAM_ID` is not a credential; it identifies, it does not authorize. It exists
because Figma states plainly that *"it is not currently possible to programmatically obtain
the team id of a user just from a token."* Read it out of the team page URL — the segment
after `/team/`.

## The three modes

| | Personal access token | Plan access token | OAuth 2 app |
| --- | --- | --- | --- |
| **Plan required** | none | **Organization or Enterprise only** | none |
| **Tied to** | the individual user | the plan — no user | the individual user, via your app |
| **Header** | `X-Figma-Token: <token>` | `X-Figma-Token: <token>` | `Authorization: Bearer <token>` |
| **Max expiration** | **90 days** | **365 days** | access token **90 days**, refreshable |
| **Rotation** | none — regenerate by hand | refresh supported; old secret works 24 h | refresh token, reusable indefinitely |
| **Scoped** | yes, chosen at creation | yes, plus a **resource allowlist** | yes, per app and per authorize call |
| **Least privilege** | ✗ reaches anything the user can | ✓ plan-scoped and resource-scoped | ✓ |
| **Who creates it** | any user | **org admin with MFA** | app developer; the user consents |
| **Setup cost** | trivial | admin involvement | callback server + review flow |
| **Survives offboarding** | ✗ dies with the user | ✓ | ✓ admins can reassign |
| **Revocation** | instant, from Settings → Security | instant, and cannot be undone | via the app |
| **Rate limit counted per** | **per user**, per plan | **per token**, per plan | per user, per plan, **per app** |

The rate-limit row matters more than it looks: every script sharing one personal access
token shares **one budget**. Plan tokens are counted per token, so separate tokens isolate
workloads. See [Plans and limits](/cyber-figma/reference/plans-and-limits/).

Base URL is `https://api.figma.com`. Figma for Government is a separate host,
`https://api.figma-gov.com`.

## Personal access tokens

The default for `cyber-figma`, and the mode Figma itself names for scripts and local
tooling.

Created at **Settings → Security → Generate new token**, where you choose the expiration
and the scopes. **The token is shown once.** From that screen you can see each token's
scopes and its approximate last-used time, and revoke it instantly.

Why it is the default here:

- It is the **only** mode that covers the entire surface the tool would wrap. Plan tokens
  cannot write comments or variables and cannot call `/v1/me`; OAuth cannot call the
  Payments API at all.
- It works on **every plan**, including Starter and Professional.
- No callback server, no app registration, no Figma review.
- `X-Figma-Token` is one static header, so the client stays trivial.

### Two real weaknesses

**1. A shared budget.** The quota is per user, so every process using that token competes
for it. `cyber-figma` is designed to honor `Retry-After` with backoff and to surface
`X-Figma-Rate-Limit-Type` and `X-Figma-Upgrade-Link` from the `429`, so a user hitting the
View-seat wall can see *why*.

**2. A 90-day ceiling with no rotation.**

:::caution[Expiry looks like a permission error]
Per Figma's file-endpoints error table, an **expired or invalid token returns `403`, not
`401`**. Collapsing `403` into "permission denied" is the difference between a ten-second
fix and a support ticket, so `cyber-figma` treats expiry as a distinct case in its `403`
handling.
:::

The 90-day maximum is stated on Figma's plan-access-tokens comparison table rather than on
the personal-access-tokens page itself. A **"No expiration" option previously existed and
was removed** as a security change, so plan for rotation rather than waiting for a
non-expiring token. The maximum number of tokens per account is undocumented, and there is
**no automatic rotation** — only plan access tokens support refresh.

### Where to keep the token

:::caution
Resist pasting that `export` straight into `~/.zshrc` or `~/.bashrc`. Shell profiles are
created world-readable, and they are the files most likely to end up in a dotfiles repo, a
screen share, or a pasted snippet.
:::

Keep the secret in its own restricted file and source it:

```sh
touch ~/.secrets && chmod 600 ~/.secrets
echo 'export FIGMA_ACCESS_TOKEN=<your-pat>' >> ~/.secrets
```

```sh
# in ~/.zshrc or ~/.bashrc
[[ -f ~/.secrets ]] && source ~/.secrets
```

The profile now carries a path, not a credential, so it stays safe to commit and share.
Non-secrets like `FIGMA_TEAM_ID` can stay in the profile. A password manager's CLI keeps
the value off disk entirely:

```sh
export FIGMA_ACCESS_TOKEN=$(op read op://vault/figma/token)
```

If a token has already been sitting in a shared or committed file, treat it as compromised
and revoke it from Settings → Security. Deleting the line does not revoke the token, and
rewriting git history does not un-publish it.

:::note[Unexpanded `${VAR}` references]
Some agent hosts forward the literal text `${FIGMA_ACCESS_TOKEN}` when the variable is
unset instead of substituting a value. `cyber-figma` treats a value that is exactly an
unexpanded reference as **absent**, so a missing credential reports itself as missing
instead of being sent to Figma verbatim. Fix it by exporting the variable in the
environment that launches the agent.
:::

## Plan access tokens

Generally available since **23 July 2026**. Created by org admins at
[figma.com/developers/tokens](https://www.figma.com/developers/tokens). Creation
**requires MFA** on the admin's account, unless the org enforces "Members must log in with
SSO".

They use the same `X-Figma-Token` header as a personal access token, so `cyber-figma`
supports them as a first-class second mode for CI and org automation. They are strictly
better for that job: plan-scoped, resource-scoped via an allowlist, refreshable, and they
survive the offboarding of whoever created them.

Two categories exist:

- **REST API tokens** — customizable scopes, plus a resource choice of *All resources* or
  *Only selected resources* (a list of file, project, team, or workspace links).
- **Figma CLI tokens** — a fixed scope set for Code Connect and codebase uploads. Not
  general-purpose.

### What a plan token cannot do

:::danger
A plan access token **cannot be the only credential** for a tool that writes comments or
variables.
:::

| Blocked | Because it requires |
| --- | --- |
| Post or delete comments and comment reactions | `file_comments:write` |
| `POST /v1/files/{file_key}/variables` | `file_variables:write` |
| `GET /v1/me` | plan tokens are not tied to a user |
| `GET /v1/oembed` | not supported |
| Code Connect writes | `file_code_connect:write` |

Because `/v1/me` is unavailable, a connection check must not depend on it in this mode; the
fallback is `GET /v1/files/{file_key}/meta` against a configured file.

**Refresh behavior:** refreshing an active (non-revoked, non-expired) token recomputes
expiry as *today plus the original lifetime*, and **the previous secret keeps working for
24 hours** — a genuine zero-downtime rotation window. Revocation is immediate and
irreversible; a revoked token must be replaced by a new one, with its scopes and resource
access re-selected.

## OAuth 2

:::note[Deferred]
`cyber-figma` does not implement OAuth 2 today. It is the right choice for a hosted
multi-user product, but it demands a callback server and an app-review lifecycle that a
local CLI should not carry. It is documented here because two endpoint groups —
**Activity Logs** and **Discovery** — can never work with a personal access token.
:::

Authorization-code flow only (`response_type=code`), with PKCE supported using **S256
only**. Apps start in **draft** (testable only by you and plan admins), then publish as
**private** (your team or org, no review) or **public** (Figma review required). Since the
2025-09-23 platform update, all OAuth apps must complete the publishing flow to stay
active.

| Method | URL | Notes |
| --- | --- | --- |
| `GET` | `https://www.figma.com/oauth` | Authorization page. Params: `client_id`, `redirect_uri`, `scope`, `state`, `response_type=code`, optional `code_challenge` |
| `POST` | `https://api.figma.com/v1/oauth/token` | Exchange the code. Form-encoded, HTTP Basic with `client_id:client_secret`. Returns `user_id_string`, `access_token`, `token_type`, `expires_in`, `refresh_token` |
| `POST` | `https://api.figma.com/v1/oauth/refresh` | Body: `refresh_token`. Returns a new access token and **no new refresh token** |

Things that break naive implementations:

- **Authorization codes expire 30 seconds after issue** — the exchange must be immediate
  and server-side.
- **Figma stores only one access token per app per user**, so refreshing immediately
  invalidates the previous access token. A client that keeps stale tokens around will break
  itself.
- The refresh response returns **no new refresh token** — keep the original.
- Use `user_id_string`, not the deprecated numeric `user_id`. Figma user IDs look numeric
  but do not all fit in a JavaScript number or a Go `float64`.
- The authorize URL must open in a **real browser** — WebView is unsupported.
- Access tokens expire after **90 days** by default; `expires_in` is in seconds.

## OAuth scopes

Figma publishes 24 scopes. A token's scopes **never exceed the user's actual Figma
permissions** — *"Scopes do not supersede the permissions granted to you by an organization
or the owner of a project, team, or file."*

| Scope | What it unlocks | Plan / role note |
| --- | --- | --- |
| `current_user:read` | Read your name, email, and profile image (`GET /v1/me`) | |
| `file_comments:read` | Read the comments for files | |
| `file_comments:write` | Post and delete comments and comment reactions in files | |
| `file_content:read` | Read the contents of files, such as nodes and the editor type | |
| `file_dev_resources:read` | Read dev resources in files | |
| `file_dev_resources:write` | Write dev resources to files | |
| `file_metadata:read` | Read metadata of files — also gates oEmbed | |
| `file_variables:read` | Read variables in files | **Enterprise plan only** |
| `file_variables:write` | Write variables and collections in files | **Enterprise plan only** |
| `file_versions:read` | Read the version history for files you can access | |
| `files:read` | **Deprecated.** Read files, projects, users, versions, comments, components, styles, and webhooks | Deprecated — see below |
| `library_analytics:read` | Read your design system analytics | **Enterprise plan only** |
| `library_assets:read` | Read data of individual published components and styles | |
| `library_content:read` | Read published components and styles of files | |
| `org:activity_log_read` | Read organization activity logs | **Enterprise only. Org admin** |
| `org:ai_metering_usage_read` | Read organization AI usage | **Enterprise only. Org admin** |
| `org:developer_log_read` | Read organization developer logs | **Enterprise + Governance+. Org admin** |
| `org:discovery_read` | Read text event data in the organization | **Enterprise + Governance+. Org admin** |
| `project_metadata:read` | Read metadata of projects | |
| `projects:read` | List projects and files in projects | |
| `selections:read` | Read most recent selection in files you can access | ⚠️ no documented endpoint consumes this |
| `team_library_content:read` | Read published components and styles of teams | |
| `webhooks:read` | Read metadata of webhooks | |
| `webhooks:write` | Create and manage webhooks | |

**On `files:read`:** it still works, but Figma calls it "extremely permissive" and says it
is "highly recommended you use the granular scopes." Most read endpoints accept *either*
their granular scope or `files:read`. `cyber-figma` requests **granular scopes only**. The
older `file_read` scope is deprecated for OAuth 2 tokens.

Two documented scopes have no documented consumer: `selections:read` has no endpoint in
the OpenAPI spec or the prose docs, and `file_code_connect:write` is referenced on the
plan-access-tokens page but is absent from the published scopes table. Code Connect is
driven by the Figma CLI rather than by documented REST endpoints.

## Which scope does which endpoint group need

| Endpoint group | Scope | Plan token? | PAT? |
| --- | --- | --- | --- |
| `GET file`, `file nodes`, `images`, `image fills` | `file_content:read` | ✅ | ✅ |
| `GET file meta`, oEmbed | `file_metadata:read` | oEmbed ❌ | ✅ |
| Version history | `file_versions:read` | ✅ | ✅ |
| Team projects, project files | `projects:read` | ✅ | ✅ |
| Project metadata | `project_metadata:read` | ✅ | ✅ |
| Comments — read | `file_comments:read` | ✅ | ✅ |
| Comments and reactions — write | `file_comments:write` | ❌ | ✅ |
| `GET /v1/me` | `current_user:read` | ❌ | ✅ |
| Components / sets / styles — team-scoped | `team_library_content:read` | ✅ | ✅ |
| Components / sets / styles — file-scoped | `library_content:read` | ✅ | ✅ |
| Components / sets / styles — by key | `library_assets:read` | ✅ | ✅ |
| Webhooks v2 — read / write | `webhooks:read` / `webhooks:write` | ✅ | ✅ |
| Dev Resources — read / write | `file_dev_resources:read` / `:write` | ✅ | ✅ |
| Variables — read | `file_variables:read` | ✅ | ✅ |
| Variables — write | `file_variables:write` | ❌ | ✅ |
| Library Analytics | `library_analytics:read` | ✅ | ✅ |
| Activity Logs | `org:activity_log_read` | ✅ | ❌ |
| Developer Logs | `org:developer_log_read` | ✅ **only** | ❌ |
| AI Usage | `org:ai_metering_usage_read` | ✅ **only** | ❌ |
| Discovery | `org:discovery_read` | ❌ — OAuth 2 per the docs | ❌ |
| Payments | n/a — **no OAuth support at all** | ❌ | ✅ **only** |

Plan gating for the same groups is on
[Plans and limits](/cyber-figma/reference/plans-and-limits/).

## SCIM is a different API

Figma's SCIM API is explicitly *"distinct from the Figma REST API"* — a different base URL
(`https://www.figma.com/scim/v2/:tenantid`), different endpoints, and its own bearer token
generated at Admin Settings → SCIM Provisioning. It handles user lifecycle, **not
authentication**, is not supported on Starter or Professional, and is **out of scope for
`cyber-figma`**.

## Sources

- [Authentication](https://developers.figma.com/docs/rest-api/authentication/)
- [Personal access tokens](https://developers.figma.com/docs/rest-api/personal-access-tokens/)
- [Plan access tokens](https://developers.figma.com/docs/rest-api/plan-access-tokens/)
- [OAuth apps](https://developers.figma.com/docs/rest-api/oauth-apps/)
- [Scopes](https://developers.figma.com/docs/rest-api/scopes/)
- [Errors](https://developers.figma.com/docs/rest-api/errors/)
- [SCIM](https://developers.figma.com/docs/rest-api/scim/)

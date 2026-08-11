import type { FigmaClient } from '../client.js'
import type {
	GetTeamWebhooksResponse,
	GetWebhookRequestsResponse,
	GetWebhooksResponse,
	WebhookV2,
	WebhookV2Event,
	WebhookV2Status,
} from '../figma-types.js'
import {
	collectPages,
	type PaginatedResult,
	type PaginationOptions,
	type PaginationSpec,
	paginationParamsFor,
} from '../pagination.js'

// Webhooks v2 — the only Figma family that is not on /v1/, and the only one
// whose write side outnumbers its read side. The gateway knows the paths and
// the wire bodies; every rule about who may create a webhook, what a passcode
// is allowed to be, and what may be printed lives in api.ts.

/**
 * `GET /v2/webhooks` paginates **only** when queried by `plan_api_id`; the
 * `context` + `context_id` form returns everything at once and ignores
 * `cursor`. One endpoint cannot declare two models, so it declares the real
 * one — a context query simply comes back with no `pagination` object, which
 * `readPage` reports as "no next cursor".
 */
export const WEBHOOK_LIST_PAGINATION: PaginationSpec = { model: 'url_cursor', itemsKey: 'webhooks' }

/** The three things a webhook can watch. Figma takes them lowercase and reports them uppercase. */
export type WebhookContext = 'team' | 'project' | 'file'

export type WebhookListQuery = {
	context?: WebhookContext
	contextId?: string
	/** `team-<teamId>` on Professional, `organization-<orgId>` above it. Mutually exclusive with contextId. */
	planApiId?: string
}

export type WebhookCreateBody = {
	event_type: WebhookV2Event
	context: WebhookContext
	context_id: string
	endpoint: string
	passcode: string
	status?: WebhookV2Status
	description?: string
}

/**
 * The `PUT` body. It does **not** accept `context`/`context_id`: a webhook
 * cannot be re-targeted after creation, only re-pointed at a new endpoint.
 */
export type WebhookUpdateBody = {
	event_type: WebhookV2Event
	endpoint: string
	passcode: string
	status?: WebhookV2Status
	description?: string
}

export type WebhookGateway = {
	list: (query: WebhookListQuery, opts?: PaginationOptions) => Promise<PaginatedResult<WebhookV2>>
	/** `GET /v2/teams/{team_id}/webhooks` — deprecated by Figma; superseded by `list({ context: 'team' })`. */
	listByTeam: (teamId: string) => Promise<GetTeamWebhooksResponse>
	get: (webhookId: string) => Promise<WebhookV2>
	create: (body: WebhookCreateBody) => Promise<WebhookV2>
	update: (webhookId: string, body: WebhookUpdateBody) => Promise<WebhookV2>
	/** Returns the deleted webhook. Figma documents this as irreversible. */
	remove: (webhookId: string) => Promise<WebhookV2>
	requests: (webhookId: string) => Promise<GetWebhookRequestsResponse>
}

export function createFigmaWebhookGateway(client: FigmaClient): WebhookGateway {
	const at = (webhookId: string, suffix = '') => `/v2/webhooks/${encodeURIComponent(webhookId)}${suffix}`

	return {
		list: (query, opts) =>
			collectPages<WebhookV2>(
				WEBHOOK_LIST_PAGINATION,
				(page) =>
					client.request<GetWebhooksResponse>({
						method: 'GET',
						path: '/v2/webhooks',
						query: {
							context: query.context,
							context_id: query.contextId,
							plan_api_id: query.planApiId,
							...paginationParamsFor(WEBHOOK_LIST_PAGINATION, page),
						},
					}),
				opts,
			),
		listByTeam: (teamId) => client.request({ method: 'GET', path: `/v2/teams/${encodeURIComponent(teamId)}/webhooks` }),
		get: (webhookId) => client.request({ method: 'GET', path: at(webhookId) }),
		create: (body) => client.request({ method: 'POST', path: '/v2/webhooks', body }),
		update: (webhookId, body) => client.request({ method: 'PUT', path: at(webhookId), body }),
		remove: (webhookId) => client.request({ method: 'DELETE', path: at(webhookId) }),
		requests: (webhookId) => client.request({ method: 'GET', path: at(webhookId, '/requests') }),
	}
}

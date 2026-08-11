import { describe } from 'vitest'
import type { FigmaClient, FigmaRequest } from '../client.js'
import { FigmaApiError } from '../figma-error.js'
import type { WebhookV2 } from '../figma-types.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { createPaginatingClient } from '../testing/paginating-gateway.js'
import { createWebhookApi } from './api.js'
import { defineWebhookAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaWebhookGateway, WEBHOOK_LIST_PAGINATION } from './gateway.js'

const PLAN = 'team-123'

/**
 * A stand-in for the webhook half of the Figma API, with the two behaviours the
 * lifecycle contract turns on: it keeps the webhooks it is given, and it blanks
 * the passcode on reads exactly as Figma documents. The mutating half of a
 * domain cannot be checked against a queue of canned responses.
 */
function createWebhookServerDouble(): FigmaClient {
	const stored = new Map<string, WebhookV2>()
	let nextId = 1

	const notFound = (method: FigmaRequest['method'], path: string) =>
		new FigmaApiError({ status: 404, method, path, detail: 'Not found' })
	// Figma returns the passcode only from the write endpoints; a GET always
	// blanks it.
	const blanked = (webhook: WebhookV2) => ({ ...webhook, passcode: '' })

	return {
		authMode: 'personal',
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			const { method, path } = request
			const id = /^\/v2\/webhooks\/([^/]+)/.exec(path)?.[1]
			const webhook = id ? stored.get(decodeURIComponent(id)) : undefined
			const body = (request.body ?? {}) as Partial<WebhookV2>

			if (method === 'GET' && path === '/v2/webhooks') {
				const query = request.query ?? {}
				const matches = [...stored.values()].filter((candidate) =>
					query.context_id ? candidate.context_id === query.context_id : true,
				)
				return { webhooks: matches.map(blanked) } as T
			}
			if (method === 'GET' && path.endsWith('/webhooks') && path.startsWith('/v2/teams/')) {
				return { webhooks: [...stored.values()].map(blanked) } as T
			}
			if (method === 'POST' && path === '/v2/webhooks') {
				const created = {
					id: `wh-${nextId++}`,
					team_id: '',
					plan_api_id: PLAN,
					client_id: null,
					status: 'ACTIVE',
					description: null,
					...body,
				} as WebhookV2
				stored.set(created.id, created)
				return created as T
			}
			if (!webhook || !id) throw notFound(method, path)
			if (method === 'GET' && path.endsWith('/requests')) return { requests: [] } as T
			if (method === 'GET') return blanked(webhook) as T
			if (method === 'PUT') {
				const updated = { ...webhook, ...body } as WebhookV2
				stored.set(updated.id, updated)
				return updated as T
			}
			if (method === 'DELETE') {
				stored.delete(webhook.id)
				return webhook as T
			}
			throw notFound(method, path)
		},
	}
}

/**
 * The paging double, driven by the cursor the gateway actually put on the wire
 * rather than by one handed to it out of band — so a gateway that forgets to
 * send its cursor fails here instead of silently re-reading page one.
 */
function createCursorAwareClient(pages: unknown[][]): FigmaClient {
	const paging = createPaginatingClient(WEBHOOK_LIST_PAGINATION, pages)
	return {
		authMode: 'personal',
		request: <T = unknown>(request: FigmaRequest) =>
			paging.request(request, { cursor: request.query?.cursor as string | undefined }) as Promise<T>,
	}
}

describe('webhook domain', () => {
	const api = createWebhookApi(createFigmaWebhookGateway(createWebhookServerDouble()))

	describe(
		'against a stateful double',
		defineWebhookAcceptanceSpecs({
			api,
			list: () => api.list({ plan: PLAN }),
			write: {
				context: 'file',
				contextId: 'FILEKEY',
				endpoint: 'https://example.com/hook',
				passcode: 'a-real-passcode',
			},
		}),
	)
})

// The list contract every domain's list operation owes, against the wire shape
// Figma sends for this endpoint's model.
describe(
	'webhook list pagination',
	defineListPaginationAcceptanceSpecs({
		model: 'url_cursor',
		list: (opts) =>
			createWebhookApi(
				createFigmaWebhookGateway(createCursorAwareClient([[{ id: 'w1' }], [{ id: 'w2' }], [{ id: 'w3' }]])),
			).list({ plan: PLAN, ...opts }),
	}),
)

import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaWebhookGateway, WEBHOOK_LIST_PAGINATION } from './gateway.js'

// Webhooks v2 is the only endpoint family that is not on /v1/, and it is the
// only family that is mostly mutating — so what these tests pin down first is
// the path prefix and the method of every call.
describe('createFigmaWebhookGateway', () => {
	it('lists the webhooks of a context', async () => {
		const client = createRecordingClient([{ webhooks: [] }])

		await createFigmaWebhookGateway(client).list({ context: 'team', contextId: '123' })

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v2/webhooks',
			query: { context: 'team', context_id: '123' },
		})
	})

	it('lists every webhook on a plan', async () => {
		const client = createRecordingClient([{ webhooks: [] }])

		await createFigmaWebhookGateway(client).list({ planApiId: 'organization-99' })

		expect(client.requests[0]?.query).toMatchObject({ plan_api_id: 'organization-99' })
	})

	it('sends the cursor of the page it was asked for', async () => {
		const client = createRecordingClient([{ webhooks: [] }])

		await createFigmaWebhookGateway(client).list({ planApiId: 'team-1' }, { cursor: 'abc' })

		expect(client.requests[0]?.query).toMatchObject({ cursor: 'abc' })
	})

	it('declares the model this endpoint actually uses when a plan id is given', () => {
		expect(WEBHOOK_LIST_PAGINATION).toEqual({ model: 'url_cursor', itemsKey: 'webhooks' })
	})

	it('gets one webhook by id', async () => {
		const client = createRecordingClient([{ id: 'w1' }])

		await createFigmaWebhookGateway(client).get('w 1')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v2/webhooks/w%201' })
	})

	it('creates a webhook with its body', async () => {
		const client = createRecordingClient([{ id: 'w1' }])
		const body = {
			event_type: 'FILE_UPDATE' as const,
			context: 'file' as const,
			context_id: 'abc',
			endpoint: 'https://example.com/hook',
			passcode: 'secret',
		}

		await createFigmaWebhookGateway(client).create(body)

		expect(client.requests[0]).toMatchObject({ method: 'POST', path: '/v2/webhooks', body })
	})

	it('updates a webhook by id', async () => {
		const client = createRecordingClient([{ id: 'w1' }])

		await createFigmaWebhookGateway(client).update('w1', {
			event_type: 'PING',
			endpoint: 'https://example.com/hook',
			passcode: 'secret',
		})

		expect(client.requests[0]).toMatchObject({ method: 'PUT', path: '/v2/webhooks/w1' })
	})

	it('deletes a webhook by id', async () => {
		const client = createRecordingClient([{ id: 'w1' }])

		await createFigmaWebhookGateway(client).remove('w1')

		expect(client.requests[0]).toMatchObject({ method: 'DELETE', path: '/v2/webhooks/w1' })
	})

	it('reads the recent requests of a webhook', async () => {
		const client = createRecordingClient([{ requests: [] }])

		await createFigmaWebhookGateway(client).requests('w1')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v2/webhooks/w1/requests' })
	})

	it('reaches the deprecated team endpoint only when asked for it by name', async () => {
		const client = createRecordingClient([{ webhooks: [] }])

		await createFigmaWebhookGateway(client).listByTeam('123')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v2/teams/123/webhooks' })
	})
})

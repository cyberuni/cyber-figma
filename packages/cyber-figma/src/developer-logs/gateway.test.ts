import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaDeveloperLogGateway, DEVELOPER_LOG_PAGINATION } from './gateway.js'

const PAGE = { status: 200, error: false, meta: { items: [], cursor: null, has_more: false } }

describe('developer log gateway', () => {
	it('reads the log with a POST, because Figma takes the filters in the body', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaDeveloperLogGateway(client).list({})

		expect(client.requests[0]).toMatchObject({ method: 'POST', path: '/v1/developer_logs' })
	})

	it('puts the filters in the body rather than the query string', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaDeveloperLogGateway(client).list({
			tokenType: 'plan_access_token',
			token: 'figd_abc',
			tokenName: 'ci',
			userEmail: 'dev@example.com',
			ipAddress: '10.0.0',
			eventSource: 'mcp_server',
			dateRange: 'last_7d',
		})

		expect(client.requests[0].query).toBeUndefined()
		expect(client.requests[0].body).toEqual({
			token_type: 'plan_access_token',
			token: 'figd_abc',
			token_name: 'ci',
			user_email: 'dev@example.com',
			ip_address: '10.0.0',
			event_source: 'mcp_server',
			date_range: 'last_7d',
		})
	})

	it('sends an empty body when nothing was filtered, not a body full of nulls', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaDeveloperLogGateway(client).list({})

		expect(client.requests[0].body).toEqual({})
	})

	it('puts the cursor and limit in the body too, where this endpoint reads them', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaDeveloperLogGateway(client).list({}, { cursor: 'c1', pageSize: 25 })

		expect(client.requests[0].body).toEqual({ cursor: 'c1', limit: 25 })
	})

	it('reads the entries out of the meta envelope', async () => {
		const client = createRecordingClient([
			{ status: 200, error: false, meta: { items: [{ uuid: 'u1' }], cursor: 'c2', has_more: true } },
		])
		const result = await createFigmaDeveloperLogGateway(client).list({})

		expect(result.data).toEqual([{ uuid: 'u1' }])
		expect(result.next_cursor).toBe('c2')
	})

	it('stops offering a cursor once Figma nulls it out', async () => {
		const client = createRecordingClient([PAGE])

		expect((await createFigmaDeveloperLogGateway(client).list({})).next_cursor).toBeNull()
	})

	it("declares the meta_cursor model, whose fields differ from AI Usage's", () => {
		expect(DEVELOPER_LOG_PAGINATION).toEqual({ model: 'meta_cursor', itemsKey: 'items' })
	})
})

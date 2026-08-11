import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createDeveloperLogApi } from './api.js'
import { createFigmaDeveloperLogGateway } from './gateway.js'

const PAGE = { status: 200, error: false, meta: { items: [], cursor: null, has_more: false } }

function apiWith() {
	const client = createRecordingClient([PAGE])
	return { api: createDeveloperLogApi(createFigmaDeveloperLogGateway(client)), client }
}

describe('developer log api', () => {
	it('passes the filters through to the body', async () => {
		const { api, client } = apiWith()
		await api.list({ eventSource: 'mcp_server', dateRange: 'last_24h' })

		expect(client.requests[0].body).toMatchObject({ event_source: 'mcp_server', date_range: 'last_24h' })
	})

	it('rejects an event source Figma does not have, naming the two it does', async () => {
		const { api, client } = apiWith()

		await expect(api.list({ eventSource: 'plugin' })).rejects.toThrowError(/rest_api.*mcp_server/)
		expect(client.requests).toHaveLength(0)
	})

	it('rejects a date range outside the three Figma offers', async () => {
		const { api } = apiWith()

		await expect(api.list({ dateRange: 'last_90d' })).rejects.toThrowError(/last_24h.*last_7d.*last_30d/)
	})

	it('explains the 30-day retention when a longer range is asked for', async () => {
		const { api } = apiWith()

		await expect(api.list({ dateRange: 'last_90d' })).rejects.toThrowError(/30 days/)
	})

	it('rejects a token type outside the three Figma records', async () => {
		const { api } = apiWith()

		await expect(api.list({ tokenType: 'personal_access_token' })).rejects.toThrowError(
			/plan_access_token.*developer_token.*oauth_token/,
		)
	})

	it('returns the uniform paginated result', async () => {
		const { api } = apiWith()

		await expect(api.list({})).resolves.toMatchObject({ count: 0, pagination_model: 'meta_cursor' })
	})
})

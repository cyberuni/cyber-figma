import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createAiUsageApi } from './api.js'
import { createFigmaAiUsageGateway } from './gateway.js'

const PAGE = { rows: [], next_cursor: '', has_next_page: false }

function apiWith() {
	const client = createRecordingClient([PAGE])
	return { api: createAiUsageApi(createFigmaAiUsageGateway(client)), client }
}

describe('ai usage api', () => {
	it('returns the uniform paginated result for a valid window', async () => {
		const { api } = apiWith()

		await expect(api.daily({ startDate: '2026-01-01', endDate: '2026-01-31' })).resolves.toMatchObject({
			count: 0,
			pagination_model: 'next_cursor',
		})
	})

	it('requires both ends of the window, because Figma does', async () => {
		const { api } = apiWith()

		await expect(api.daily({ startDate: '2026-01-01', endDate: '' })).rejects.toThrowError(/end_date/)
	})

	it('rejects a date that is not YYYY-MM-DD before spending a request', async () => {
		const { api, client } = apiWith()

		await expect(api.daily({ startDate: '2026/01/01', endDate: '2026-01-31' })).rejects.toThrowError(/YYYY-MM-DD/)
		expect(client.requests).toHaveLength(0)
	})

	it('rejects a start before 2025-12-01, which is the earliest data Figma has', async () => {
		const { api } = apiWith()

		await expect(api.daily({ startDate: '2025-11-30', endDate: '2026-01-31' })).rejects.toThrowError(/2025-12-01/)
	})

	it('accepts the first day Figma has data for', async () => {
		const { api } = apiWith()

		await expect(api.daily({ startDate: '2025-12-01', endDate: '2026-01-31' })).resolves.toBeDefined()
	})

	it('rejects a window that ends before it starts', async () => {
		const { api } = apiWith()

		await expect(api.daily({ startDate: '2026-02-01', endDate: '2026-01-01' })).rejects.toThrowError(/end_date/)
	})

	it('warns in the error that an unknown email is a 400 rather than an empty result', async () => {
		const { api, client } = apiWith()
		await api.daily({ startDate: '2026-01-01', endDate: '2026-01-31', userEmail: 'dev@example.com' })

		expect(client.requests[0].query).toMatchObject({ user_email: 'dev@example.com' })
	})
})

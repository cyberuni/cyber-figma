import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { AI_USAGE_PAGINATION, createFigmaAiUsageGateway } from './gateway.js'

const PAGE = { rows: [], next_cursor: '', has_next_page: false }

describe('ai usage gateway', () => {
	it('asks Figma for the daily credit aggregates', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaAiUsageGateway(client).daily({ startDate: '2026-01-01', endDate: '2026-01-31' })

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/ai_usage/daily',
			query: { start_date: '2026-01-01', end_date: '2026-01-31' },
		})
	})

	it('restricts to one user when an email is given', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaAiUsageGateway(client).daily({
			startDate: '2026-01-01',
			endDate: '2026-01-31',
			userEmail: 'dev@example.com',
		})

		expect(client.requests[0].query).toMatchObject({ user_email: 'dev@example.com' })
	})

	it('sends the cursor and limit this endpoint pages with', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaAiUsageGateway(client).daily(
			{ startDate: '2026-01-01', endDate: '2026-01-31' },
			{ cursor: 'c1', pageSize: 100 },
		)

		expect(client.requests[0].query).toMatchObject({ cursor: 'c1', limit: 100 })
	})

	it('caps a page size above the documented maximum instead of letting Figma reject it', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaAiUsageGateway(client).daily(
			{ startDate: '2026-01-01', endDate: '2026-01-31' },
			{ pageSize: 5000 },
		)

		expect(client.requests[0].query).toMatchObject({ limit: 1000 })
	})

	it('reads the rows and treats the empty next_cursor as exhausted', async () => {
		const client = createRecordingClient([{ rows: [{ day: '2026-01-01' }], next_cursor: '', has_next_page: false }])
		const result = await createFigmaAiUsageGateway(client).daily({ startDate: '2026-01-01', endDate: '2026-01-31' })

		expect(result.data).toEqual([{ day: '2026-01-01' }])
		expect(result.next_cursor).toBeNull()
	})

	it('declares the next_cursor model and the 1000-row page ceiling', () => {
		expect(AI_USAGE_PAGINATION).toEqual({
			model: 'next_cursor',
			itemsKey: 'rows',
			defaultPageSize: 1000,
			maxPageSize: 1000,
		})
	})
})

import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createActivityLogApi, parseActivityLogTime } from './api.js'
import { createFigmaActivityLogGateway } from './gateway.js'

const PAGE = { status: 200, error: false, meta: { activity_logs: [], cursor: null, next_page: false } }

function apiWith() {
	const client = createRecordingClient([PAGE])
	return { api: createActivityLogApi(createFigmaActivityLogGateway(client)), client }
}

describe('activity log times', () => {
	it('takes a Unix timestamp as it is', () => {
		expect(parseActivityLogTime('start_time', '1700000000')).toBe(1_700_000_000)
	})

	it('takes an ISO 8601 instant, because that is what a log window is written in', () => {
		expect(parseActivityLogTime('start_time', '2023-11-14T22:13:20Z')).toBe(1_700_000_000)
	})

	it('takes a plain calendar date as midnight UTC', () => {
		expect(parseActivityLogTime('start_time', '2023-11-14')).toBe(1_699_920_000)
	})

	it('names the parameter when the value is neither', () => {
		expect(() => parseActivityLogTime('end_time', 'last tuesday')).toThrowError(/end_time/)
	})
})

describe('activity log api', () => {
	it('sends the parsed window as Unix seconds', async () => {
		const { api, client } = apiWith()
		await api.list({ startTime: '2023-11-14T22:13:20Z', endTime: '1700086400' })

		expect(client.requests[0].query).toMatchObject({ start_time: 1_700_000_000, end_time: 1_700_086_400 })
	})

	it('splits a comma-separated event filter, because that is how Figma takes it', async () => {
		const { api, client } = apiWith()
		await api.list({ events: 'file.create, file.delete' })

		expect(client.requests[0].query).toMatchObject({ events: ['file.create', 'file.delete'] })
	})

	it('rejects a limit that is not a positive integer before spending a request', async () => {
		const { api, client } = apiWith()

		await expect(api.list({ limit: 0 })).rejects.toThrowError(/limit/)
		expect(client.requests).toHaveLength(0)
	})

	it('rejects an order Figma does not accept', async () => {
		const { api } = apiWith()

		await expect(api.list({ order: 'sideways' })).rejects.toThrowError(/asc.*desc/)
	})

	it('rejects a window whose end precedes its start', async () => {
		const { api } = apiWith()

		await expect(api.list({ startTime: '2026-02-01', endTime: '2026-01-01' })).rejects.toThrowError(/end_time/)
	})

	it('returns the uniform result, with the has_more flag the envelope carries', async () => {
		const { api } = apiWith()

		await expect(api.list({})).resolves.toMatchObject({
			count: 0,
			pagination_model: 'none',
			has_more: false,
			cursor: null,
		})
	})
})

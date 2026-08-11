import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createDiscoveryApi } from './api.js'
import { createFigmaDiscoveryGateway } from './gateway.js'

const RESPONSE = {
	urls: { '2026/01/01/00': ['https://s3/a.json', 'https://s3/b.json'], '2026/01/01/01': ['https://s3/c.json'] },
}

// Every window in these specs is anchored to a fixed "now", so the "at least an
// hour in the past" rule is tested rather than the clock.
const NOW = Date.parse('2026-01-02T00:00:00Z')

function apiWith(response: unknown = RESPONSE) {
	const client = createRecordingClient([response])
	return { api: createDiscoveryApi(createFigmaDiscoveryGateway(client), () => NOW), client }
}

describe('discovery api', () => {
	it('reports the hours as rows, newest key order preserved, with a total', async () => {
		const { api } = apiWith()
		const result = await api.textEvents({ startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-01T02:00:00Z' })

		expect(result.hours).toEqual([
			{ hour: '2026/01/01/00', urls: ['https://s3/a.json', 'https://s3/b.json'] },
			{ hour: '2026/01/01/01', urls: ['https://s3/c.json'] },
		])
		expect(result.total_urls).toBe(3)
	})

	it('requires a start of the window', async () => {
		const { api } = apiWith()

		await expect(api.textEvents({ startDate: '' })).rejects.toThrowError(/start_date/)
	})

	it('rejects a start that is not an ISO 8601 instant', async () => {
		const { api } = apiWith()

		await expect(api.textEvents({ startDate: 'yesterday' })).rejects.toThrowError(/ISO 8601/)
	})

	it('rejects a start less than an hour in the past, which Figma refuses', async () => {
		const { api, client } = apiWith()

		await expect(api.textEvents({ startDate: '2026-01-01T23:30:00Z' })).rejects.toThrowError(/one hour/i)
		expect(client.requests).toHaveLength(0)
	})

	it('rejects a window longer than the 24 hours Figma allows', async () => {
		const { api } = apiWith()

		await expect(
			api.textEvents({ startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-02T00:00:01Z' }),
		).rejects.toThrowError(/24 hours/)
	})

	it('rejects an end that precedes the start', async () => {
		const { api } = apiWith()

		await expect(
			api.textEvents({ startDate: '2026-01-01T06:00:00Z', endDate: '2026-01-01T05:00:00Z' }),
		).rejects.toThrowError(/end_date/)
	})

	it('rejects a link lifetime outside the 60–86400 second range', async () => {
		const { api } = apiWith()

		await expect(api.textEvents({ startDate: '2026-01-01T00:00:00Z', fileTtlSeconds: 30 })).rejects.toThrowError(
			/60.*86400/,
		)
	})

	it('reports an empty window as no hours rather than as nothing at all', async () => {
		const { api } = apiWith({ urls: {} })
		const result = await api.textEvents({ startDate: '2026-01-01T00:00:00Z' })

		expect(result.hours).toEqual([])
		expect(result.total_urls).toBe(0)
	})
})

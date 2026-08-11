import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaDiscoveryGateway, DISCOVERY_PAGINATION } from './gateway.js'

// What the *client* hands back: it has already unwrapped the `{status, error,
// meta}` envelope this endpoint uses, which the request below declares.
const RESPONSE = { urls: { '2026/01/01/00': ['https://s3/a.json'] } }

describe('discovery gateway', () => {
	it('asks Figma for the text events in a window', async () => {
		const client = createRecordingClient([RESPONSE])
		await createFigmaDiscoveryGateway(client).textEvents({ startDate: '2026-01-01T00:00:00Z' })

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/discovery',
			query: { start_date: '2026-01-01T00:00:00Z' },
			unwrap: 'meta',
		})
	})

	it('sends the optional end of the window and the link lifetime', async () => {
		const client = createRecordingClient([RESPONSE])
		await createFigmaDiscoveryGateway(client).textEvents({
			startDate: '2026-01-01T00:00:00Z',
			endDate: '2026-01-01T06:00:00Z',
			fileTtlSeconds: 3600,
		})

		expect(client.requests[0].query).toMatchObject({
			end_date: '2026-01-01T06:00:00Z',
			file_ttl_in_seconds: 3600,
		})
	})

	it('sends no link lifetime when none was asked for, so Figma applies its own default', async () => {
		const client = createRecordingClient([RESPONSE])
		await createFigmaDiscoveryGateway(client).textEvents({ startDate: '2026-01-01T00:00:00Z' })

		expect(client.requests[0].query).not.toHaveProperty('file_ttl_in_seconds')
	})

	it('returns the hour-keyed download map the endpoint answers with', async () => {
		const client = createRecordingClient([RESPONSE])
		const result = await createFigmaDiscoveryGateway(client).textEvents({ startDate: '2026-01-01T00:00:00Z' })

		expect(result.urls).toEqual({ '2026/01/01/00': ['https://s3/a.json'] })
	})

	it('declares no pagination: one response covers the whole window', () => {
		expect(DISCOVERY_PAGINATION.model).toBe('none')
	})
})

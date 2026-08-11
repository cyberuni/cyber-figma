import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { ACTIVITY_LOG_PAGINATION, createFigmaActivityLogGateway } from './gateway.js'

const PAGE = { status: 200, error: false, meta: { activity_logs: [], cursor: 'abc', next_page: false } }

describe('activity log gateway', () => {
	it('asks Figma for the org activity log', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaActivityLogGateway(client).list({})

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/activity_logs' })
	})

	it('sends the filters Figma documents', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaActivityLogGateway(client).list({
			events: ['file.create', 'file.delete'],
			startTime: 1_700_000_000,
			endTime: 1_700_086_400,
			limit: 50,
			order: 'desc',
		})

		expect(client.requests[0].query).toEqual({
			events: ['file.create', 'file.delete'],
			start_time: 1_700_000_000,
			end_time: 1_700_086_400,
			limit: 50,
			order: 'desc',
		})
	})

	it('sends no filters at all when none were given, so Figma applies its own defaults', async () => {
		const client = createRecordingClient([PAGE])
		await createFigmaActivityLogGateway(client).list({})

		expect(client.requests[0].query).toEqual({})
	})

	it('reads the events out of the meta envelope', async () => {
		const client = createRecordingClient([
			{ status: 200, error: false, meta: { activity_logs: [{ id: 'e1' }], cursor: 'c1', next_page: true } },
		])
		const result = await createFigmaActivityLogGateway(client).list({})

		expect(result.data).toEqual([{ id: 'e1' }])
		expect(result.count).toBe(1)
	})

	it('reports that more events matched the window, and the cursor Figma sent with it', async () => {
		const client = createRecordingClient([
			{ status: 200, error: false, meta: { activity_logs: [{ id: 'e1' }], cursor: 'c1', next_page: true } },
		])
		const result = await createFigmaActivityLogGateway(client).list({})

		expect(result.has_more).toBe(true)
		expect(result.cursor).toBe('c1')
	})

	// The response advertises a cursor and Figma documents no request parameter
	// that consumes it. Declaring row_cursor here would advertise a --cursor flag
	// that silently re-requests page one forever.
	it('declares no pagination, because the endpoint takes no cursor', () => {
		expect(ACTIVITY_LOG_PAGINATION).toEqual({ model: 'none', itemsKey: 'activity_logs' })
	})
})

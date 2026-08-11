import { expect, it } from 'vitest'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import type { ActivityLogApi } from './api.js'

// The contract the activity log owes, as a factory the unit suite runs against
// a double and the system suite runs against the live API.

export type ActivityLogAcceptanceDeps = {
	api: ActivityLogApi
}

export function defineActivityLogAcceptanceSpecs(deps: ActivityLogAcceptanceDeps) {
	return () => {
		it('returns events with the uniform result shape', async () => {
			const result = await deps.api.list({ limit: 5 })

			expect(Array.isArray(result.data)).toBe(true)
			expect(result.count).toBe(result.data.length)
		})

		it('reports whether more events matched the window than came back', async () => {
			expect(typeof (await deps.api.list({ limit: 1 })).has_more).toBe('boolean')
		})

		it('accepts a time window written as ISO instants', async () => {
			await expect(
				deps.api.list({ startTime: '2026-01-01T00:00:00Z', endTime: '2026-02-01T00:00:00Z', limit: 5 }),
			).resolves.toBeDefined()
		})

		it('accepts the descending order Figma documents', async () => {
			await expect(deps.api.list({ order: 'desc', limit: 5 })).resolves.toBeDefined()
		})

		it('refuses a window that ends before it starts', async () => {
			await expect(deps.api.list({ startTime: '2026-02-01', endTime: '2026-01-01' })).rejects.toThrowError(/end_time/)
		})

		// Declared `none`: the response carries a cursor, but Figma documents no
		// request parameter that takes it back.
		defineListPaginationAcceptanceSpecs({
			model: 'none',
			// The options are deliberately dropped: this endpoint has no pagination
			// parameters to pass them to, which is exactly what `none` asserts.
			list: () => deps.api.list({ limit: 5 }),
		})()
	}
}

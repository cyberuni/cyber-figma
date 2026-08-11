import { expect, it } from 'vitest'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { AI_USAGE_FIRST_DAY, type AiUsageApi } from './api.js'

// The contract AI Usage owes, as a factory the unit suite runs against a double
// and the system suite runs against the live API.

export type AiUsageAcceptanceDeps = {
	api: AiUsageApi
	/** A window the account has data in. `YYYY-MM-DD`, on or after 2025-12-01. */
	startDate: string
	endDate: string
	/** Set false when the account cannot supply a second page of rows. */
	includeMultiPage?: boolean
}

export function defineAiUsageAcceptanceSpecs(deps: AiUsageAcceptanceDeps) {
	return () => {
		const window = { startDate: deps.startDate, endDate: deps.endDate }

		it('returns daily rows with the uniform result shape', async () => {
			const result = await deps.api.daily(window)

			expect(Array.isArray(result.data)).toBe(true)
			expect(result.count).toBe(result.data.length)
		})

		it('accepts a single-day window', async () => {
			await expect(deps.api.daily({ startDate: deps.startDate, endDate: deps.startDate })).resolves.toBeDefined()
		})

		it(`refuses a start before ${AI_USAGE_FIRST_DAY}, where Figma's data begins`, async () => {
			await expect(deps.api.daily({ ...window, startDate: '2025-11-30' })).rejects.toThrowError(/2025-12-01/)
		})

		it('refuses a window that ends before it starts', async () => {
			await expect(deps.api.daily({ startDate: deps.endDate, endDate: deps.startDate })).rejects.toThrowError(
				/end_date/,
			)
		})

		it('refuses a window with no end, because Figma requires both bounds', async () => {
			await expect(deps.api.daily({ startDate: deps.startDate, endDate: '' })).rejects.toThrowError(/end_date/)
		})

		defineListPaginationAcceptanceSpecs({
			model: 'next_cursor',
			includeMultiPage: deps.includeMultiPage,
			list: (opts) => deps.api.daily({ ...window, ...opts }),
		})()
	}
}

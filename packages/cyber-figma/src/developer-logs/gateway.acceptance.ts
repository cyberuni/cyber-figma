import { expect, it } from 'vitest'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import type { DeveloperLogApi } from './api.js'

// The contract the developer log owes, as a factory the unit suite runs against
// a double and the system suite runs against the live API.

export type DeveloperLogAcceptanceDeps = {
	api: DeveloperLogApi
	/** Set false when the account cannot supply a second page of entries. */
	includeMultiPage?: boolean
}

export function defineDeveloperLogAcceptanceSpecs(deps: DeveloperLogAcceptanceDeps) {
	return () => {
		it('returns entries with the uniform result shape', async () => {
			const result = await deps.api.list({ pageSize: 5 })

			expect(Array.isArray(result.data)).toBe(true)
			expect(result.count).toBe(result.data.length)
		})

		it('filters to the MCP server half of the traffic', async () => {
			await expect(deps.api.list({ eventSource: 'mcp_server', pageSize: 5 })).resolves.toBeDefined()
		})

		it('accepts each date range Figma retains', async () => {
			for (const dateRange of ['last_24h', 'last_7d', 'last_30d']) {
				await expect(deps.api.list({ dateRange, pageSize: 5 })).resolves.toBeDefined()
			}
		})

		it('refuses a range beyond the 30 days Figma retains', async () => {
			await expect(deps.api.list({ dateRange: 'last_90d' })).rejects.toThrowError(/30 days/)
		})

		defineListPaginationAcceptanceSpecs({
			model: 'meta_cursor',
			includeMultiPage: deps.includeMultiPage,
			list: (opts) => deps.api.list({ pageSize: 5, ...opts }),
		})()
	}
}

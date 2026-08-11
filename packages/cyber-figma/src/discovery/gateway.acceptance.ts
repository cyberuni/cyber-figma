import { expect, it } from 'vitest'
import type { DiscoveryApi } from './api.js'

// The contract Discovery owes, as a factory the unit suite runs against a double
// and the system suite runs against the live API.

export type DiscoveryAcceptanceDeps = {
	api: DiscoveryApi
	/** An ISO 8601 UTC instant at least an hour in the past. */
	startDate: string
	/** At most 24 hours after the start. */
	endDate: string
}

export function defineDiscoveryAcceptanceSpecs(deps: DiscoveryAcceptanceDeps) {
	return () => {
		it('returns one entry per hour of the window, with a link total', async () => {
			const result = await deps.api.textEvents({ startDate: deps.startDate, endDate: deps.endDate })

			expect(Array.isArray(result.hours)).toBe(true)
			expect(result.total_urls).toBe(result.hours.reduce((total, hour) => total + hour.urls.length, 0))
		})

		it('keys each entry by the hour Figma names it with', async () => {
			const result = await deps.api.textEvents({ startDate: deps.startDate, endDate: deps.endDate })

			for (const hour of result.hours) expect(hour.hour).toMatch(/^\d{4}\/\d{2}\/\d{2}\/\d{2}$/)
		})

		it('accepts a link lifetime inside the range Figma allows', async () => {
			await expect(
				deps.api.textEvents({ startDate: deps.startDate, endDate: deps.endDate, fileTtlSeconds: 3600 }),
			).resolves.toBeDefined()
		})

		it('refuses a link lifetime below Figma’s minimum', async () => {
			await expect(deps.api.textEvents({ startDate: deps.startDate, fileTtlSeconds: 30 })).rejects.toThrowError(/60/)
		})

		it('refuses a window longer than 24 hours', async () => {
			const start = Date.parse(deps.startDate)
			const tooLate = new Date(start + 25 * 60 * 60 * 1000).toISOString()

			await expect(deps.api.textEvents({ startDate: deps.startDate, endDate: tooLate })).rejects.toThrowError(
				/24 hours/,
			)
		})

		it('refuses a start less than an hour in the past', async () => {
			await expect(deps.api.textEvents({ startDate: new Date().toISOString() })).rejects.toThrowError(/one hour/i)
		})
	}
}

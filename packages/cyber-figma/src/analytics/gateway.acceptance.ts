import { expect, it } from 'vitest'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import type { AnalyticsApi } from './api.js'
import type { LibraryAnalyticsAsset } from './gateway.js'

// The contract Library Analytics owes, as a factory the unit suite runs against
// doubles and the system suite runs against the live API. Both halves are held
// to the same bar: six (asset, metric) pairs, one pagination model, and a
// grouping dimension whose legal values depend on which pair you asked for.

export type AnalyticsAcceptanceDeps = {
	api: AnalyticsApi
	/** The key of a *published library* file — analytics reports on libraries, not ordinary files. */
	fileKey: string
	/** Set false when the account cannot supply a second page of rows. */
	includeMultiPage?: boolean
}

const ASSETS: LibraryAnalyticsAsset[] = ['component', 'style', 'variable']

export function defineAnalyticsAcceptanceSpecs(deps: AnalyticsAcceptanceDeps) {
	return () => {
		for (const asset of ASSETS) {
			it(`reports ${asset} actions as a weekly series grouped by ${asset}`, async () => {
				const result = await deps.api.actions(asset, deps.fileKey, { groupBy: asset })

				expect(Array.isArray(result.data)).toBe(true)
				expect(result.pagination_model).toBe('row_cursor')
			})

			it(`reports ${asset} actions grouped by team`, async () => {
				await expect(deps.api.actions(asset, deps.fileKey, { groupBy: 'team' })).resolves.toMatchObject({
					pagination_model: 'row_cursor',
				})
			})

			it(`reports ${asset} usages as a snapshot grouped by ${asset}`, async () => {
				await expect(deps.api.usages(asset, deps.fileKey, { groupBy: asset })).resolves.toMatchObject({
					pagination_model: 'row_cursor',
				})
			})

			it(`reports ${asset} usages grouped by file`, async () => {
				await expect(deps.api.usages(asset, deps.fileKey, { groupBy: 'file' })).resolves.toMatchObject({
					pagination_model: 'row_cursor',
				})
			})

			// The asymmetry is the whole point of splitting actions from usages: a
			// caller that groups usages by team, or actions by file, is asking for a
			// dimension that endpoint does not have.
			it(`refuses to group ${asset} usages by team`, async () => {
				await expect(deps.api.usages(asset, deps.fileKey, { groupBy: 'team' })).rejects.toThrowError(/group_by/)
			})

			it(`refuses to group ${asset} actions by file`, async () => {
				await expect(deps.api.actions(asset, deps.fileKey, { groupBy: 'file' })).rejects.toThrowError(/group_by/)
			})
		}

		it('accepts a date window on the actions endpoints', async () => {
			await expect(
				deps.api.actions('component', deps.fileKey, {
					groupBy: 'component',
					startDate: '2026-01-01',
					endDate: '2026-02-01',
				}),
			).resolves.toBeDefined()
		})

		defineListPaginationAcceptanceSpecs({
			model: 'row_cursor',
			includeMultiPage: deps.includeMultiPage,
			list: (opts) => deps.api.actions('component', deps.fileKey, { groupBy: 'component', ...opts }),
		})()
	}
}

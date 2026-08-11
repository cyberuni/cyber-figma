import { describe, expect, it } from 'vitest'
import { createAnalyticsApi } from './api.js'
import { createFigmaAnalyticsGateway } from './gateway.js'
import { createAnalyticsPagingClient } from './paging-double.js'

function apiWith(pages: unknown[][] = [[{ week: '2026-01-05' }]]) {
	const client = createAnalyticsPagingClient(pages)
	return { api: createAnalyticsApi(createFigmaAnalyticsGateway(client)), client }
}

describe('analytics api', () => {
	it('takes the library file key out of a pasted Figma URL', async () => {
		const { api, client } = apiWith()
		await api.actions('component', 'https://www.figma.com/design/lib123/Design-System', { groupBy: 'component' })

		expect(client.requests[0].path).toBe('/v1/analytics/libraries/lib123/component/actions')
	})

	it('returns the uniform paginated result', async () => {
		const { api } = apiWith([[{ week: '2026-01-05' }]])
		const result = await api.usages('style', 'lib123', { groupBy: 'file' })

		expect(result).toMatchObject({ count: 1, pagination_model: 'row_cursor', page_count: 1 })
	})

	it('rejects a group_by the actions endpoint does not accept, naming the ones it does', async () => {
		const { api } = apiWith()

		await expect(api.actions('component', 'lib123', { groupBy: 'file' })).rejects.toThrowError(
			/group_by.*component.*team/i,
		)
	})

	it('rejects a group_by the usages endpoint does not accept', async () => {
		const { api } = apiWith()

		await expect(api.usages('variable', 'lib123', { groupBy: 'team' })).rejects.toThrowError(/variable.*file/i)
	})

	it('accepts the asset itself as the grouping dimension for both metrics', async () => {
		const { api } = apiWith()

		await expect(api.actions('style', 'lib123', { groupBy: 'style' })).resolves.toBeDefined()
		await expect(api.usages('style', 'lib123', { groupBy: 'style' })).resolves.toBeDefined()
	})

	it('rejects a date that is not YYYY-MM-DD before spending a request', async () => {
		const { api, client } = apiWith()

		await expect(api.actions('component', 'lib123', { groupBy: 'team', startDate: '01/02/2026' })).rejects.toThrowError(
			/YYYY-MM-DD/,
		)
		expect(client.requests).toHaveLength(0)
	})

	it('walks every page when asked to fetch them all', async () => {
		const { api } = apiWith([[{ a: 1 }], [{ b: 2 }], [{ c: 3 }]])
		const result = await api.actions('variable', 'lib123', { groupBy: 'team', fetchAll: true })

		expect(result.data).toHaveLength(3)
		expect(result.page_count).toBe(3)
	})
})

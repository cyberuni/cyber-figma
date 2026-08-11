import { describe, expect, it } from 'vitest'
import { createFigmaAnalyticsGateway, LIBRARY_ANALYTICS_PAGINATION } from './gateway.js'
import { createAnalyticsPagingClient } from './paging-double.js'

function client() {
	return createAnalyticsPagingClient([[{ week: '2026-01-05' }]])
}

describe('library analytics gateway', () => {
	it('asks Figma for component actions of the library file', async () => {
		const double = client()
		await createFigmaAnalyticsGateway(double).actions('component', 'lib123', { groupBy: 'component' })

		expect(double.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/analytics/libraries/lib123/component/actions',
			query: { group_by: 'component' },
		})
	})

	it('encodes a file key that needs escaping into the path', async () => {
		const double = client()
		await createFigmaAnalyticsGateway(double).usages('style', 'a/b', { groupBy: 'file' })

		expect(double.requests[0].path).toBe('/v1/analytics/libraries/a%2Fb/style/usages')
	})

	it('sends the date window on an actions request', async () => {
		const double = client()
		await createFigmaAnalyticsGateway(double).actions('variable', 'lib123', {
			groupBy: 'team',
			startDate: '2026-01-01',
			endDate: '2026-02-01',
		})

		expect(double.requests[0].query).toMatchObject({
			group_by: 'team',
			start_date: '2026-01-01',
			end_date: '2026-02-01',
		})
	})

	it('sends no date window on a usages request, because the endpoint has none', async () => {
		const double = client()
		await createFigmaAnalyticsGateway(double).usages('component', 'lib123', { groupBy: 'file' })

		expect(double.requests[0].query).not.toHaveProperty('start_date')
		expect(double.requests[0].query).not.toHaveProperty('end_date')
	})

	it('paginates with the opaque row cursor these endpoints use', async () => {
		const double = createAnalyticsPagingClient([[{ a: 1 }], [{ b: 2 }]])
		const result = await createFigmaAnalyticsGateway(double).actions('style', 'lib123', { groupBy: 'style' })

		expect(result.pagination_model).toBe('row_cursor')
		expect(result.next_cursor).toBe('1')
	})

	it('declares the row_cursor model these six endpoints share', () => {
		expect(LIBRARY_ANALYTICS_PAGINATION).toEqual({ model: 'row_cursor', itemsKey: 'rows' })
	})
})

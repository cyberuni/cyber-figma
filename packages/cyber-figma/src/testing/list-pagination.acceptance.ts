import { expect, it } from 'vitest'
import type { PaginatedResult, PaginationModel, PaginationOptions } from '../pagination.js'

// The contract every list operation owes, whichever pagination model it sits
// on. A domain pod runs this factory twice: once from its
// `*.acceptance.test.ts` against a double, and once from its `*.system.ts`
// against the live API, so the double and Figma are held to the same bar.

export type ListPaginationAcceptanceDeps<T = unknown> = {
	list: (opts?: PaginationOptions) => Promise<PaginatedResult<T>>
	/** The model this endpoint declares. `none` relaxes the walking specs. */
	model: PaginationModel
	/** Set false when the fixture or the live account cannot supply a second page. */
	includeMultiPage?: boolean
}

export function defineListPaginationAcceptanceSpecs<T>(deps: ListPaginationAcceptanceDeps<T>) {
	const paginates = deps.model !== 'none'
	const multiPage = paginates && deps.includeMultiPage !== false

	return () => {
		it('returns the uniform result shape', async () => {
			const result = await deps.list()

			expect(Array.isArray(result.data)).toBe(true)
			expect(result.count).toBe(result.data.length)
			expect(result.page_count).toBe(1)
			expect(result).toHaveProperty('next_cursor')
		})

		it('reports the pagination model it actually uses', async () => {
			expect((await deps.list()).pagination_model).toBe(deps.model)
		})

		it('reports a single unwalked page as untruncated', async () => {
			expect((await deps.list()).truncated).toBe(false)
		})

		if (!paginates) {
			// An endpoint that returns everything at once must say so, so a caller
			// can tell "there is no more" from "this never paginates".
			it('reports no cursor, because this endpoint returns everything at once', async () => {
				expect((await deps.list()).next_cursor).toBeNull()
			})

			it('ignores fetchAll rather than failing on it', async () => {
				const all = await deps.list({ fetchAll: true })
				expect(all.page_count).toBe(1)
				expect(all.truncated).toBe(false)
			})
			return
		}

		if (!multiPage) return

		it('offers a cursor for the next page', async () => {
			expect((await deps.list()).next_cursor).toBeTruthy()
		})

		it('returns different items when that cursor is followed', async () => {
			const first = await deps.list()
			const second = await deps.list({ cursor: first.next_cursor ?? undefined, after: first.next_cursor ?? undefined })

			expect(second.data).not.toEqual(first.data)
		})

		it('merges every page when asked to fetch them all', async () => {
			const first = await deps.list()
			const all = await deps.list({ fetchAll: true })

			expect(all.data.length).toBeGreaterThan(first.data.length)
			expect(all.page_count).toBeGreaterThan(1)
			expect(all.count).toBe(all.data.length)
		})

		it('reports truncation when the walk stops at maxPages', async () => {
			const capped = await deps.list({ fetchAll: true, maxPages: 1 })

			expect(capped.page_count).toBe(1)
			expect(capped.truncated).toBe(true)
			expect(capped.next_cursor).toBeTruthy()
		})
	}
}

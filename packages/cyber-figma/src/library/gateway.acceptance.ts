import { expect, it } from 'vitest'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import type { LibraryFamily, LibraryGateway } from './gateway.js'

// The contract a library gateway owes, whichever of the three families it
// serves. Run once against doubles from `gateway.acceptance.test.ts` and once
// against the live API from `gateway.system.ts`, so the double and Figma are
// held to the same bar.

export type PublishedShape = { key?: unknown; file_key?: unknown; node_id?: unknown; name?: unknown }

export type LibraryAcceptanceDeps<T extends PublishedShape> = {
	family: LibraryFamily
	gateway: LibraryGateway<T>
	teamId: string
	/** A **main** file key — a branch key cannot have published content. */
	fileKey: string
	/**
	 * A published item key for the by-key spec. Omitted when the source cannot
	 * promise one — a live account may have no published library at all, and a
	 * fabricated key would test Figma's 404 rather than this contract.
	 */
	itemKey?: string
	/** Set false when the fixture or the live account cannot supply a second page. */
	includeMultiPage?: boolean
}

/** Every published item identifies itself and the file it was published from. */
function expectPublishedShape(items: PublishedShape[]) {
	for (const item of items) {
		expect(typeof item.key).toBe('string')
		expect(typeof item.file_key).toBe('string')
		expect(typeof item.node_id).toBe('string')
		expect(typeof item.name).toBe('string')
	}
}

export function defineLibraryAcceptanceSpecs<T extends PublishedShape>(deps: LibraryAcceptanceDeps<T>) {
	return () => {
		const teamList = defineListPaginationAcceptanceSpecs<T>({
			model: 'id_cursor',
			includeMultiPage: deps.includeMultiPage,
			list: (opts) => deps.gateway.listByTeam(deps.teamId, opts),
		})
		const fileList = defineListPaginationAcceptanceSpecs<T>({
			model: 'none',
			list: (opts) => deps.gateway.listByFile(deps.fileKey, opts),
		})

		teamList()
		fileList()

		it(`returns published ${deps.family} for a team`, async () => {
			expectPublishedShape((await deps.gateway.listByTeam(deps.teamId)).data)
		})

		it(`returns published ${deps.family} for a file`, async () => {
			expectPublishedShape((await deps.gateway.listByFile(deps.fileKey)).data)
		})

		if (deps.itemKey === undefined) return

		it('returns a single published item by its library key', async () => {
			const item = await deps.gateway.get(deps.itemKey as string)

			expect(item.key).toBe(deps.itemKey)
			expectPublishedShape([item])
		})
	}
}

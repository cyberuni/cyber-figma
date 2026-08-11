import type { FigmaClient } from '../client.js'
import type { PublishedComponent, PublishedComponentSet, PublishedStyle } from '../figma-types.js'
import {
	collectPages,
	type PaginatedResult,
	type PaginationOptions,
	type PaginationSpec,
	paginationParamsFor,
} from '../pagination.js'

// Components, component sets, and styles are three families with one shape:
// the same three endpoints, the same envelope, the same cursors, differing only
// in the path segment and the key the items live under. One gateway serves all
// three rather than three copies that can drift apart.
//
// Everything here reads *published library* content. A component that exists in
// a file but was never published to a library is not in any of these responses.

/** The path segment and the response key, which Figma spells the same way. */
export type LibraryFamily = 'components' | 'component_sets' | 'styles'

export type PublishedLibraryItem = PublishedComponent | PublishedComponentSet | PublishedStyle

/**
 * The team-scoped lists: `page_size` (Figma documents a default of 30 and, since
 * 2025-07-07, a maximum of 1000) with opaque integer `before`/`after` cursors
 * returned under `meta.cursor`. The cursors are internally tracked counters, not
 * ids of anything — nothing but a previous response can produce a valid one.
 */
export function libraryTeamListPagination(family: LibraryFamily): PaginationSpec {
	return { model: 'id_cursor', itemsKey: family, defaultPageSize: 30, maxPageSize: 1000 }
}

/** The file-scoped lists return every published item of the file at once. */
export function libraryFileListPagination(family: LibraryFamily): PaginationSpec {
	return { model: 'none', itemsKey: family }
}

export type LibraryGateway<T> = {
	listByTeam: (teamId: string, opts?: PaginationOptions) => Promise<PaginatedResult<T>>
	/** `fileKey` must be a **main** file key: branches cannot publish. */
	listByFile: (fileKey: string, opts?: PaginationOptions) => Promise<PaginatedResult<T>>
	get: (key: string) => Promise<T>
}

export function createFigmaLibraryGateway<T = PublishedLibraryItem>(
	client: FigmaClient,
	family: LibraryFamily,
): LibraryGateway<T> {
	const teamSpec = libraryTeamListPagination(family)
	const fileSpec = libraryFileListPagination(family)

	return {
		listByTeam: (teamId, opts) =>
			collectPages<T>(
				teamSpec,
				(page) =>
					client.request({
						method: 'GET',
						path: `/v1/teams/${encodeURIComponent(teamId)}/${family}`,
						query: paginationParamsFor(teamSpec, { ...page, applyDefaults: true }),
					}),
				opts,
			),
		listByFile: (fileKey, opts) =>
			collectPages<T>(
				fileSpec,
				() =>
					client.request({
						method: 'GET',
						path: `/v1/files/${encodeURIComponent(fileKey)}/${family}`,
						query: paginationParamsFor(fileSpec),
					}),
				opts,
			),
		// The by-key endpoints wrap the single item in the `{status, error, meta}`
		// envelope, where `meta` *is* the item rather than a container of them.
		get: (key) =>
			client.request<T>({
				method: 'GET',
				path: `/v1/${family}/${encodeURIComponent(key)}`,
				unwrap: 'meta',
			}),
	}
}

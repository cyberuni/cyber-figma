import { describe } from 'vitest'
import type { FigmaClient, FigmaRequest } from '../client.js'
import { figmaPageBody } from '../testing/paginating-gateway.js'
import { defineLibraryAcceptanceSpecs, type PublishedShape } from './gateway.acceptance.js'
import { createFigmaLibraryGateway, type LibraryFamily, libraryTeamListPagination } from './gateway.js'

// The library contract, run against a double that speaks the real wire shape of
// these endpoints: a `{status, error, meta}` envelope everywhere, integer
// cursors under `meta.cursor` on the team lists, and the single item *as*
// `meta` on the by-key reads.

function published(family: LibraryFamily, key: string): PublishedShape {
	return {
		key,
		file_key: 'main-file-key',
		node_id: '1:23',
		name: `${family} ${key}`,
	}
}

/** The page the request is asking for, read off the wire rather than passed in. */
function pageOptions(query: FigmaRequest['query']) {
	const after = query?.after
	return { after: typeof after === 'string' ? after : undefined }
}

function createLibraryClient(family: LibraryFamily, pages: PublishedShape[][]): FigmaClient {
	return {
		authMode: 'personal',
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			if (request.path.startsWith('/v1/teams/')) {
				return figmaPageBody(libraryTeamListPagination(family), pages, pageOptions(request.query)) as T
			}
			if (request.path.startsWith('/v1/files/')) {
				return { status: 200, error: false, meta: { [family]: pages.flat() } } as T
			}
			// The by-key read: the client unwraps `meta`, so the double does too.
			const key = decodeURIComponent(request.path.split('/').pop() ?? '')
			return published(family, key) as T
		},
	}
}

const FAMILIES: LibraryFamily[] = ['components', 'component_sets', 'styles']

for (const family of FAMILIES) {
	describe(
		`${family} gateway`,
		defineLibraryAcceptanceSpecs<PublishedShape>({
			family,
			gateway: createFigmaLibraryGateway<PublishedShape>(
				createLibraryClient(family, [[published(family, 'a')], [published(family, 'b')], [published(family, 'c')]]),
				family,
			),
			teamId: '1234567890',
			fileKey: 'main-file-key',
			itemKey: 'published-key',
		}),
	)
}

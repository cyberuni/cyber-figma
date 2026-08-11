import { isFigmaApiError } from '../figma-error.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import { requireTeamId } from '../scope.js'
import { fileKeyFromInput } from '../url.js'
import type { LibraryGateway, PublishedLibraryItem } from './gateway.js'
import { LIBRARY_SCOPES, type LibraryResource, MAIN_FILE_KEY_NOTE, publishedOnlyNote } from './resources.js'

// The operations the CLI and MCP both call. The three library scopes differ by
// the *scope of access* rather than by family, and Figma reports a scope the
// token lacks with the same 401/403 it uses for a missing file — so each
// operation names its own scope on the way out, which the status code cannot.

export type LibraryApi<T = PublishedLibraryItem> = {
	listByTeam: (team?: string, opts?: PaginationOptions) => Promise<PaginatedResult<T>>
	listByFile: (file: string, opts?: PaginationOptions) => Promise<PaginatedResult<T>>
	get: (key: string) => Promise<T>
}

/**
 * Attach what this operation knows and the status code does not. The spine
 * prefers an attached hint over its derived one, so the token-expiry advice a
 * bare 403 would otherwise carry is repeated here rather than lost.
 */
async function withHint<T>(hint: (status: number) => string | undefined, run: () => Promise<T>): Promise<T> {
	try {
		return await run()
	} catch (error) {
		if (isFigmaApiError(error) && !('hint' in error)) {
			const attached = hint(error.status)
			if (attached) Object.assign(error, { hint: attached })
		}
		throw error
	}
}

const EXPIRED_TOKEN_NOTE =
	'Figma also answers 403 for an expired or revoked token — personal access tokens last at most 90 days — so check Settings → Security too.'

function refusal(status: number): boolean {
	return status === 401 || status === 403
}

export function createLibraryApi<T = PublishedLibraryItem>(
	gateway: LibraryGateway<T>,
	resource: LibraryResource,
): LibraryApi<T> {
	const published = publishedOnlyNote(resource)

	return {
		listByTeam: (team, opts) =>
			withHint(
				(status) =>
					refusal(status)
						? `Listing a team's published ${resource.plural} needs the ${LIBRARY_SCOPES.team} scope on the token, plus access to that team. ${EXPIRED_TOKEN_NOTE}`
						: undefined,
				() => gateway.listByTeam(requireTeamId(team), opts),
			),
		listByFile: (file, opts) =>
			withHint(
				(status) =>
					refusal(status) || status === 404
						? `Listing a file's published ${resource.plural} needs the ${LIBRARY_SCOPES.file} scope on the token. ${MAIN_FILE_KEY_NOTE} ${published} ${EXPIRED_TOKEN_NOTE}`
						: undefined,
				// A pasted file URL works everywhere a bare key does.
				() => gateway.listByFile(fileKeyFromInput(file), opts),
			),
		get: (key) =>
			withHint(
				(status) =>
					refusal(status) || status === 404
						? `Reading a ${resource.label} by key needs the ${LIBRARY_SCOPES.key} scope. A 404 means no PUBLISHED ${resource.label} has this key — it is the library key from a published asset, not a node id, and an unpublished ${resource.label} has no key at all. ${EXPIRED_TOKEN_NOTE}`
						: undefined,
				() => gateway.get(key),
			),
	}
}

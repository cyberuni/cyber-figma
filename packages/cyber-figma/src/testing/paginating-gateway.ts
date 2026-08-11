import type { FigmaClient, FigmaRequest } from '../client.js'
import type { PaginationOptions, PaginationSpec } from '../pagination.js'

// Doubles for domain acceptance specs. They emit the real wire shape of each
// pagination model rather than a normalized one, so a gateway exercised against
// them is exercised against what Figma actually sends — including the parts
// that differ per model, which is where gateways get it wrong.

const BASE = 'https://api.figma.com/v1/example'

/** Which page the given options are asking for, in this fixture's numbering. */
function pageIndex(opts: PaginationOptions): number {
	const cursor = opts.cursor ?? opts.after
	const index = cursor === undefined ? 0 : Number(cursor)
	return Number.isFinite(index) ? index : 0
}

/**
 * The raw response body Figma would send for one page of `pages`, in the shape
 * this spec's model uses. Cursors are page indexes, so a fixture stays readable.
 */
export function figmaPageBody(spec: PaginationSpec, pages: unknown[][], opts: PaginationOptions = {}): unknown {
	if (spec.model === 'none') {
		return { [spec.itemsKey]: pages.flat() }
	}

	const index = pageIndex(opts)
	const items = pages[index] ?? []
	const hasNext = index + 1 < pages.length
	const nextCursor = String(index + 1)
	const prevCursor = index > 0 ? String(index - 1) : undefined

	switch (spec.model) {
		case 'url_cursor':
			return {
				[spec.itemsKey]: items,
				pagination: {
					...(hasNext && { next_page: `${BASE}?cursor=${nextCursor}` }),
					...(prevCursor !== undefined && { prev_page: `${BASE}?cursor=${prevCursor}` }),
				},
			}
		case 'url_page':
			return {
				[spec.itemsKey]: items,
				pagination: {
					...(hasNext && { next_page: `${BASE}?after=${nextCursor}` }),
					...(prevCursor !== undefined && { prev_page: `${BASE}?before=${prevCursor}` }),
				},
			}
		case 'id_cursor':
			return {
				status: 200,
				error: false,
				meta: {
					[spec.itemsKey]: items,
					cursor: {
						...(hasNext && { after: index + 1 }),
						...(prevCursor !== undefined && { before: index - 1 }),
					},
				},
			}
		case 'row_cursor':
			// Figma omits `cursor` entirely once `next_page` is false.
			return { [spec.itemsKey]: items, next_page: hasNext, ...(hasNext && { cursor: nextCursor }) }
		case 'next_cursor':
			// `next_cursor` is the empty string once exhausted, not null.
			return { [spec.itemsKey]: items, next_cursor: hasNext ? nextCursor : '', has_next_page: hasNext }
		case 'meta_cursor':
			// `cursor` is null once exhausted, not the empty string.
			return { meta: { [spec.itemsKey]: items, cursor: hasNext ? nextCursor : null, has_more: hasNext } }
	}
}

export type PaginatingClient = {
	request: (spec: FigmaRequest, opts?: PaginationOptions) => Promise<unknown>
	requests: FigmaRequest[]
}

/** A client stand-in that serves `pages` in this spec's wire shape. */
export function createPaginatingClient(spec: PaginationSpec, pages: unknown[][]): PaginatingClient {
	const requests: FigmaRequest[] = []
	return {
		requests,
		async request(request: FigmaRequest, opts: PaginationOptions = {}) {
			requests.push(request)
			return figmaPageBody(spec, pages, opts)
		},
	}
}

export type RecordingClient = FigmaClient & { requests: FigmaRequest[] }

/**
 * A client stand-in for non-list endpoints: serves queued responses in order and
 * records what was asked for. A queued `Error` is thrown, so error paths are
 * testable without a second double.
 */
export function createRecordingClient(responses: unknown[]): RecordingClient {
	const queue = [...responses]
	const requests: FigmaRequest[] = []
	return {
		requests,
		authMode: 'personal',
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			requests.push(request)
			if (queue.length === 0) {
				throw new Error(`createRecordingClient: no queued response for ${request.method} ${request.path}`)
			}
			const next = queue.shift()
			if (next instanceof Error) throw next
			return next as T
		},
	}
}

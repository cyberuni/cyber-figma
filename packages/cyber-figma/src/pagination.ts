import type { QueryValue } from './client.js'

// Figma does not have "a" pagination model. It has four families, whose field
// names differ again within a family, plus a large set of endpoints that return
// everything at once. Forcing one shape onto that would misreport half of them,
// so each real variant is named here and every list endpoint declares which one
// it is. Callers see one options shape going in and one result shape coming
// back, whatever the endpoint underneath does.

export type PaginationModel =
	/** `pagination.{prev,next}_page` full URLs; takes `cursor`. Comment reactions, `/v2/webhooks` with plan_api_id. */
	| 'url_cursor'
	/** `pagination.{prev,next}_page` full URLs; takes `page_size`/`before`/`after`. File versions. */
	| 'url_page'
	/** `meta.cursor.{before,after}` opaque integers; takes `page_size`/`before`/`after`. Team components, component sets, styles. */
	| 'id_cursor'
	/** `{ rows, next_page: boolean, cursor? }`; takes `cursor`. All six Library Analytics endpoints. */
	| 'row_cursor'
	/** `{ rows, next_cursor, has_next_page }`; takes `cursor`/`limit`. AI Usage. */
	| 'next_cursor'
	/** `meta: { items, cursor, has_more }`; takes `cursor`/`limit` in the body. Developer Logs. */
	| 'meta_cursor'
	/** Returns the complete set in one response. The majority of Figma's list endpoints. */
	| 'none'

export type PaginationSpec = {
	model: PaginationModel
	/** Where the items live in the response — `versions`, `rows`, `components`, … */
	itemsKey: string
	/** The page size the endpoint documents when none is sent. */
	defaultPageSize?: number
	/** The page size ceiling the endpoint documents. Larger requests are capped here. */
	maxPageSize?: number
}

export type PaginationOptions = {
	pageSize?: number
	/** The opaque forward cursor from a previous page's `next_cursor`. */
	cursor?: string
	/** Backward bound. Mutually exclusive with `after` wherever both exist. */
	before?: string
	after?: string
	fetchAll?: boolean
	maxPages?: number
	/** Send the endpoint's documented default page size when the caller set none. */
	applyDefaults?: boolean
}

export const DEFAULT_MAX_PAGES = 10

/** The request parameters this endpoint takes, from the one options shape. */
export function paginationParamsFor(spec: PaginationSpec, opts: PaginationOptions = {}): Record<string, QueryValue> {
	if (spec.model === 'none') return {}
	if (opts.before !== undefined && opts.after !== undefined) {
		throw new Error('before and after are mutually exclusive')
	}

	const requested = opts.pageSize ?? (opts.applyDefaults ? spec.defaultPageSize : undefined)
	const pageSize = requested !== undefined && spec.maxPageSize ? Math.min(requested, spec.maxPageSize) : requested

	const params: Record<string, QueryValue> = {}
	switch (spec.model) {
		case 'url_cursor':
		case 'row_cursor':
			if (opts.cursor !== undefined) params.cursor = opts.cursor
			return params
		case 'next_cursor':
		case 'meta_cursor':
			if (opts.cursor !== undefined) params.cursor = opts.cursor
			if (pageSize !== undefined) params.limit = pageSize
			return params
		case 'url_page':
		case 'id_cursor':
			if (pageSize !== undefined) params.page_size = pageSize
			if (opts.before !== undefined) params.before = opts.before
			if (opts.after !== undefined) params.after = opts.after
			return params
	}
}

export type Page<T> = {
	items: T[]
	/** The value to send back as `cursor`/`before`/`after`; null once exhausted. */
	nextCursor: string | null
	prevCursor: string | null
	/**
	 * Model A returns a whole URL rather than a cursor. The cursor is lifted out
	 * of it so callers stay on one shape, but the URL is kept for the case where
	 * a future parameter is not recoverable from it.
	 */
	nextPageUrl?: string
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** Items live at the top level on some endpoints and inside `meta` on others. */
function itemsAt(raw: unknown, key: string): unknown[] {
	const body = record(raw)
	const direct = body[key]
	if (Array.isArray(direct)) return direct
	const nested = record(body.meta)[key]
	return Array.isArray(nested) ? nested : []
}

/** The pagination cursor Figma embedded in a `prev_page`/`next_page` URL. */
function cursorInUrl(url: unknown, params: string[]): string | null {
	if (typeof url !== 'string' || !url) return null
	try {
		const search = new URL(url).searchParams
		for (const param of params) {
			const value = search.get(param)
			if (value) return value
		}
	} catch {
		return null
	}
	return null
}

function asCursor(value: unknown): string | null {
	if (typeof value === 'number') return String(value)
	return typeof value === 'string' && value !== '' ? value : null
}

export function readPage<T = unknown>(spec: PaginationSpec, raw: unknown): Page<T> {
	const body = record(raw)
	const items = itemsAt(raw, spec.itemsKey) as T[]

	switch (spec.model) {
		case 'url_cursor':
		case 'url_page': {
			const pagination = record(body.pagination)
			const params = spec.model === 'url_cursor' ? ['cursor'] : ['after', 'before', 'cursor']
			const nextUrl = pagination.next_page
			return {
				items,
				nextCursor: cursorInUrl(nextUrl, params),
				prevCursor: cursorInUrl(pagination.prev_page, spec.model === 'url_cursor' ? ['cursor'] : ['before']),
				...(typeof nextUrl === 'string' && { nextPageUrl: nextUrl }),
			}
		}
		case 'id_cursor': {
			const cursor = record(record(body.meta).cursor)
			return { items, nextCursor: asCursor(cursor.after), prevCursor: asCursor(cursor.before) }
		}
		case 'row_cursor':
			// `cursor` is simply absent once `next_page` is false.
			return { items, nextCursor: body.next_page === true ? asCursor(body.cursor) : null, prevCursor: null }
		case 'next_cursor':
			// `next_cursor` is the empty string once exhausted, which asCursor drops.
			return { items, nextCursor: body.has_next_page === true ? asCursor(body.next_cursor) : null, prevCursor: null }
		case 'meta_cursor': {
			// `cursor` is null once exhausted.
			const meta = record(body.meta)
			return { items, nextCursor: meta.has_more === true ? asCursor(meta.cursor) : null, prevCursor: null }
		}
		case 'none':
			return { items, nextCursor: null, prevCursor: null }
	}
}

/**
 * One result shape for every list endpoint, whichever of the models produced
 * it. `next_cursor` is what a caller passes back as `--cursor`, and
 * `pagination_model` names how the endpoint underneath actually behaves — so a
 * caller can tell "there is no more" from "this endpoint never paginates".
 */
export type PaginatedResult<T> = {
	data: T[]
	count: number
	next_cursor: string | null
	prev_cursor: string | null
	pagination_model: PaginationModel
	page_count: number
	truncated: boolean
}

export type FetchPage = (opts: PaginationOptions) => Promise<unknown>

/**
 * Which option carries a cursor forward for this model. The team-library and
 * file-version endpoints advance with `after`; the rest take `cursor`. Sending
 * the wrong one re-requests page one, silently and forever.
 */
function advanceWith(model: PaginationModel, cursor: string): PaginationOptions {
	return model === 'id_cursor' || model === 'url_page'
		? { after: cursor, before: undefined, cursor: undefined }
		: { cursor, after: undefined, before: undefined }
}

/**
 * One page, or every page up to `maxPages` when `fetchAll` is set. The cursor of
 * each page becomes the request for the next; `truncated` says whether the walk
 * stopped early, so a partial answer never reads as a complete one.
 */
export async function collectPages<T = unknown>(
	spec: PaginationSpec,
	fetchPage: FetchPage,
	opts: PaginationOptions = {},
): Promise<PaginatedResult<T>> {
	const first = readPage<T>(spec, await fetchPage(opts))
	const base = {
		prev_cursor: first.prevCursor,
		pagination_model: spec.model,
	}

	if (opts.fetchAll !== true || spec.model === 'none' || first.nextCursor === null) {
		return {
			...base,
			data: first.items,
			count: first.items.length,
			next_cursor: first.nextCursor,
			page_count: 1,
			truncated: false,
		}
	}

	const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES
	const data = [...first.items]
	const seen = new Set<string>()
	let cursor: string | null = first.nextCursor
	let pageCount = 1

	while (cursor !== null && pageCount < maxPages) {
		// An endpoint that hands back the cursor it was just given would spin here
		// until maxPages; stopping on the repeat reports it as truncated instead.
		if (seen.has(cursor)) break
		seen.add(cursor)

		const page: Page<T> = readPage<T>(spec, await fetchPage({ ...opts, ...advanceWith(spec.model, cursor) }))
		data.push(...page.items)
		pageCount += 1
		cursor = page.nextCursor
	}

	return {
		...base,
		data,
		count: data.length,
		next_cursor: cursor,
		page_count: pageCount,
		truncated: cursor !== null,
	}
}

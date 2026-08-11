import { z } from 'zod'
import type { PaginationOptions, PaginationSpec } from './pagination.js'

// The MCP half of the pagination normalization. A tool advertises its schema in
// the tool listing, so offering a parameter the endpoint does not have is worse
// than on the CLI — the client sees it and will confidently send it.

export type PaginationToolParams = {
	cursor?: z.ZodOptional<z.ZodString>
	page_size?: z.ZodOptional<z.ZodNumber>
	before?: z.ZodOptional<z.ZodString>
	after?: z.ZodOptional<z.ZodString>
	fetch_all?: z.ZodOptional<z.ZodBoolean>
	max_pages?: z.ZodOptional<z.ZodNumber>
}

function pageSizeSchema(spec: PaginationSpec) {
	const base = z.number().int().min(1)
	const bounded = spec.maxPageSize ? base.max(spec.maxPageSize) : base
	const notes = [
		spec.defaultPageSize !== undefined ? `default ${spec.defaultPageSize}` : undefined,
		spec.maxPageSize !== undefined ? `max ${spec.maxPageSize}` : undefined,
	].filter(Boolean)
	return bounded.optional().describe(`Results per page${notes.length ? ` (${notes.join(', ')})` : ''}`)
}

/** Exactly the parameters this endpoint's pagination model supports, and no others. */
export function paginationParams(spec: PaginationSpec): PaginationToolParams {
	if (spec.model === 'none') return {}

	const params: PaginationToolParams = {}
	if (
		spec.model === 'url_cursor' ||
		spec.model === 'row_cursor' ||
		spec.model === 'next_cursor' ||
		spec.model === 'meta_cursor'
	) {
		params.cursor = z.string().optional().describe('Cursor returned as next_cursor by a previous page')
	}
	if (
		spec.model === 'url_page' ||
		spec.model === 'id_cursor' ||
		spec.model === 'next_cursor' ||
		spec.model === 'meta_cursor'
	) {
		params.page_size = pageSizeSchema(spec)
	}
	if (spec.model === 'url_page' || spec.model === 'id_cursor') {
		params.before = z.string().optional().describe('Return the page before this id (not with after)')
		params.after = z.string().optional().describe('Return the page after this id (not with before)')
	}
	params.fetch_all = z.boolean().optional().describe('Fetch every page up to max_pages')
	params.max_pages = z.number().int().min(1).optional().describe('Maximum pages to fetch when fetch_all is true')
	return params
}

export function paginationOptions(params: {
	cursor?: string
	page_size?: number
	before?: string
	after?: string
	fetch_all?: boolean
	max_pages?: number
}): PaginationOptions {
	return {
		pageSize: params.page_size,
		cursor: params.cursor,
		before: params.before,
		after: params.after,
		fetchAll: params.fetch_all,
		maxPages: params.max_pages,
	}
}

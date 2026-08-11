import { type Command, InvalidArgumentError } from 'commander'
import { selectFormat } from './output.js'
import type { PaginatedResult, PaginationModel, PaginationOptions, PaginationSpec } from './pagination.js'

// The CLI half of the pagination normalization. A command offers exactly the
// flags its endpoint's model supports: advertising --cursor on an endpoint that
// has no cursor is a lie an agent would then act on.

export type PaginationCliOptions = {
	pageSize?: number
	cursor?: string
	before?: string
	after?: string
	all?: boolean
	maxPages?: number
}

export function parsePageSize(value: string): number {
	const pageSize = Number(value)
	if (!Number.isInteger(pageSize) || pageSize < 1) {
		throw new InvalidArgumentError('page-size must be a positive integer')
	}
	return pageSize
}

export function parseMaxPages(value: string): number {
	const maxPages = Number(value)
	if (!Number.isInteger(maxPages) || maxPages < 1) {
		throw new InvalidArgumentError('max-pages must be a positive integer')
	}
	return maxPages
}

const TAKES_CURSOR: PaginationModel[] = ['url_cursor', 'row_cursor', 'next_cursor', 'meta_cursor']
const TAKES_PAGE_SIZE: PaginationModel[] = ['url_page', 'id_cursor', 'next_cursor', 'meta_cursor']
const TAKES_BOUNDS: PaginationModel[] = ['url_page', 'id_cursor']

function pageSizeDescription(spec: PaginationSpec): string {
	const notes = [
		spec.defaultPageSize !== undefined ? `default: ${spec.defaultPageSize}` : undefined,
		spec.maxPageSize !== undefined ? `max: ${spec.maxPageSize}` : undefined,
	].filter(Boolean)
	return `Results per page${notes.length ? ` (${notes.join(', ')})` : ''}`
}

/** The pagination flags this endpoint's model actually supports, and no others. */
export function addPaginationOptions<T extends Command>(cmd: T, spec: PaginationSpec): T {
	if (spec.model === 'none') return cmd

	if (TAKES_CURSOR.includes(spec.model)) {
		cmd.option('--cursor <cursor>', 'Cursor returned as next_cursor by a previous page')
	}
	if (TAKES_PAGE_SIZE.includes(spec.model)) {
		cmd.option('--page-size <number>', pageSizeDescription(spec), parsePageSize)
	}
	if (TAKES_BOUNDS.includes(spec.model)) {
		cmd.option('--before <id>', 'Return the page before this id (not with --after)')
		cmd.option('--after <id>', 'Return the page after this id (not with --before)')
	}
	cmd.option('--all', 'Fetch every page up to --max-pages (starts at --cursor when one is given)')
	cmd.option('--max-pages <number>', 'Maximum pages to fetch with --all (default: 10)', parseMaxPages)
	return cmd
}

export function paginationOptionsFromCli(opts: PaginationCliOptions): PaginationOptions {
	if (opts.before !== undefined && opts.after !== undefined) {
		throw new InvalidArgumentError('--before and --after are mutually exclusive')
	}
	return {
		pageSize: opts.pageSize,
		cursor: opts.cursor,
		before: opts.before,
		after: opts.after,
		fetchAll: opts.all,
		maxPages: opts.maxPages,
	}
}

/**
 * The cursor hint — AXI principle 9, text mode only. An endpoint that does not
 * paginate says so instead of leaving the caller to wonder whether it silently
 * truncated.
 */
export function printNextPageHint<T>(result: PaginatedResult<T>, command: string, argv: string[] = process.argv): void {
	if (selectFormat(argv) !== 'text') return
	if (result.next_cursor) {
		console.log(`\nMore results. Next page: ${command} --cursor ${result.next_cursor}`)
		if (result.truncated) console.log(`Stopped at --max-pages after ${result.page_count} pages.`)
	}
}

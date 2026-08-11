import type { Command } from 'commander'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileApi } from './api.js'
import { fileCommand } from './cli.js'

// The CLI layer holds no HTTP and no formatting of its own; what it does hold is
// the shape of what an agent reads back, so that is what these pin down.

function stubApi(overrides: Partial<FileApi> = {}): { api: FileApi; calls: unknown[][] } {
	const calls: unknown[][] = []
	const record =
		<T>(name: string, result: T) =>
		(...args: unknown[]) => {
			calls.push([name, ...args])
			return Promise.resolve(result)
		}

	return {
		calls,
		api: {
			get: record('get', {
				name: 'Design',
				version: '1',
				role: 'owner',
				editorType: 'figma',
				lastModified: '2026-08-01T00:00:00Z',
				document: {
					id: '0:0',
					name: 'Document',
					type: 'DOCUMENT',
					children: [{ id: '1:2', name: 'Page 1', type: 'CANVAS' }],
				},
			}),
			nodes: record('nodes', { nodes: { '1:2': { document: { id: '1:2', name: 'Frame', type: 'FRAME' } } } }),
			images: record('images', {
				images: [
					{ node_id: '1:2', url: 'https://a', rendered: true },
					{ node_id: '3:4', url: null, rendered: false },
				],
				rendered_count: 1,
				failed_count: 1,
				failed_node_ids: ['3:4'],
				url_expires_after_days: 30,
			}),
			imageFills: record('imageFills', { images: [], count: 0, url_expires_after_days: 14 }),
			meta: record('meta', { name: 'Design', last_touched_at: '2026-08-01T00:00:00Z', editorType: 'figma' }),
			versions: record('versions', {
				data: [{ id: 'v1', created_at: '2026-08-01T00:00:00Z', label: 'Launch', user: { handle: 'ada' } }],
				count: 1,
				next_cursor: null,
				prev_cursor: null,
				pagination_model: 'url_page',
				page_count: 1,
				truncated: false,
			}),
			...overrides,
		} as FileApi,
	}
}

/** The real program turns a usage error into exit code 2; here it is thrown instead. */
function throwOnUsageError(command: Command): Command {
	command.exitOverride().configureOutput({ writeErr: () => {} })
	for (const sub of command.commands) throwOnUsageError(sub)
	return command
}

async function run(args: string[], api: FileApi): Promise<string> {
	const lines: string[] = []
	const log = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
		lines.push(parts.join(' '))
	})
	try {
		await throwOnUsageError(fileCommand(() => api)).parseAsync(args, { from: 'user' })
	} finally {
		log.mockRestore()
	}
	return lines.join('\n')
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('file get', () => {
	it('lists the pages of the document', async () => {
		const { api } = stubApi()

		expect(await run(['get', 'abc123'], api)).toContain('Page 1')
	})

	it('passes the narrowing options through instead of interpreting them', async () => {
		const { api, calls } = stubApi()
		await run(['get', 'abc123', '--ids', '1-2', '--depth', '2', '--geometry'], api)

		expect(calls[0]).toEqual(['get', 'abc123', expect.objectContaining({ ids: '1-2', depth: 2, geometry: 'paths' })])
	})

	it('accepts "all" as the explicit request for the whole tree', async () => {
		const { api, calls } = stubApi()
		await run(['get', 'abc123', '--depth', 'all'], api)

		expect(calls[0]?.[2]).toMatchObject({ depth: 'all' })
	})

	it('rejects a depth that is not a positive integer', async () => {
		const { api } = stubApi()

		await expect(run(['get', 'abc123', '--depth', '0'], api)).rejects.toThrowError(/positive integer/)
	})
})

describe('file images', () => {
	it('explains a null url as a per-node outcome rather than a failed call', async () => {
		const { api } = stubApi()
		const out = await run(['images', 'abc123', '--ids', '1-2,3-4'], api)

		expect(out).toContain('3:4')
		expect(out).toMatch(/not a failed call/)
	})

	it('warns that the urls expire', async () => {
		const { api } = stubApi()

		expect(await run(['images', 'abc123', '--ids', '1-2'], api)).toMatch(/expire 30 days/)
	})

	it('rejects a scale outside the documented range before the call is made', async () => {
		const { api, calls } = stubApi()

		await expect(run(['images', 'abc123', '--ids', '1-2', '--scale', '9'], api)).rejects.toThrowError(/0\.01/)
		expect(calls).toHaveLength(0)
	})
})

describe('file image-fills', () => {
	it('names what was empty rather than printing nothing', async () => {
		const { api } = stubApi()

		expect(await run(['image-fills', 'abc123'], api)).toContain('0 image fills found')
	})
})

describe('file meta', () => {
	it('reports the metadata and points at the tier-1 command as the expensive one', async () => {
		const { api } = stubApi()
		const out = await run(['meta', 'abc123'], api)

		expect(out).toContain('Design')
		expect(out).toMatch(/tier 1/)
	})
})

describe('file versions', () => {
	it('offers this endpoint own pagination flags and passes them on', async () => {
		const { api, calls } = stubApi()
		await run(['versions', 'abc123', '--page-size', '5'], api)

		expect(calls[0]).toEqual(['versions', 'abc123', expect.objectContaining({ pageSize: 5 })])
	})

	it('lists the version history', async () => {
		const { api } = stubApi()

		expect(await run(['versions', 'abc123'], api)).toContain('Launch')
	})
})

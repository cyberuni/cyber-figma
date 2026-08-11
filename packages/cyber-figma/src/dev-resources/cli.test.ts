import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DevResourceApi } from './api.js'
import { devResourceCommand } from './cli.js'
import { summarizeWrite } from './write-result.js'

const LINK = { id: 'dr-1', name: 'PR', url: 'https://example.com/pr/1', file_key: 'abc123', node_id: '1:2' }

function run(args: string[], api: Partial<DevResourceApi>) {
	const lines: string[] = []
	vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
		lines.push(parts.join(' '))
	})
	return devResourceCommand(() => api as DevResourceApi)
		.parseAsync(args, { from: 'user' })
		.then(() => lines.join('\n'))
}

afterEach(() => vi.restoreAllMocks())

describe('help', () => {
	// The REST endpoints carry no plan gate, but the surface the links appear in
	// does — a caller who cannot see them in Dev Mode should learn why here.
	it('names what these links need to be visible, and the branch-key rule', () => {
		let help = ''
		devResourceCommand(() => ({}) as DevResourceApi)
			.configureOutput({
				writeOut: (text) => {
					help += text
				},
			})
			.outputHelp()

		expect(help).toContain('Dev Mode')
		expect(help).toContain('Dev seat')
		expect(help).toContain('main file key')
	})
})

describe('list', () => {
	it('names what was empty when a file has no dev resources', async () => {
		const output = await run(['list', 'abc123'], {
			list: async () => ({
				data: [],
				count: 0,
				next_cursor: null,
				prev_cursor: null,
				pagination_model: 'none',
				page_count: 1,
				truncated: false,
			}),
		})

		expect(output).toContain('0 dev resources found')
	})
})

describe('create', () => {
	// The trap, at the surface an agent reads: a partial success must not print
	// as a clean success.
	it('reports the failures that came back inside a 200', async () => {
		const output = await run(['create', 'abc123', '--node', '1-2,9-9', '--name', 'PR', '--url', 'https://x.test/1'], {
			create: async () =>
				summarizeWrite('create', 2, [LINK], [{ file_key: 'abc123', node_id: '9:9', error: 'Duplicate url' }]),
		})

		expect(output).toContain('1 of 2')
		expect(output).toContain('Duplicate url')
	})

	// Nothing was written, so the command must fail rather than acknowledge it —
	// the top-level handler turns the throw into a nonzero exit code.
	it('fails the command when Figma rejected every link', async () => {
		await expect(
			run(['create', 'abc123', '--node', '1-2', '--name', 'PR', '--url', 'https://x.test/1'], {
				create: async () => summarizeWrite('create', 1, [], [{ file_key: 'abc123', node_id: '1:2', error: 'Nope' }]),
			}),
		).rejects.toThrow(/Nope/)
	})
})

describe('delete', () => {
	it('says so when the dev resource was already gone', async () => {
		const output = await run(['delete', 'abc123', 'dr-1'], {
			remove: async () => ({ deleted: true, resource: 'dev resource', id: 'dr-1', already_absent: true }),
		})

		expect(output).toContain('already deleted')
	})
})

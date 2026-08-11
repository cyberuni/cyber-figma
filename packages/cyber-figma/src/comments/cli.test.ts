import { afterEach, describe, expect, it, vi } from 'vitest'
import { installUsageErrors } from '../cli-usage.js'
import type { Comment } from '../figma-types.js'
import type { PaginatedResult } from '../pagination.js'
import type { CommentApi } from './api.js'
import { commentCommand } from './cli.js'

function comment(over: Partial<Comment> = {}): Comment {
	return {
		id: '1',
		client_meta: { x: 0, y: 0 },
		file_key: 'abc123',
		user: { id: 'u1', handle: 'ada', img_url: '' },
		created_at: '2026-01-01T00:00:00Z',
		resolved_at: null,
		message: 'hello',
		order_id: '1',
		reactions: [],
		...over,
	}
}

function page<T>(data: T[]): PaginatedResult<T> {
	return {
		data,
		count: data.length,
		next_cursor: null,
		prev_cursor: null,
		pagination_model: 'none',
		page_count: 1,
		truncated: false,
	}
}

type Call = { name: string; args: unknown[] }

/** A CLI test drives the command against the api the domain exposes, not HTTP. */
function fakeApi(overrides: Partial<CommentApi> = {}) {
	const calls: Call[] = []
	const record =
		<T>(name: string, result: T) =>
		(...args: unknown[]) => {
			calls.push({ name, args })
			return Promise.resolve(result)
		}
	const api = {
		list: record('list', page([comment()])),
		create: record('create', comment({ id: '7' })),
		remove: record('remove', { deleted: true, resource: 'comment', id: '99', already_absent: false }),
		listReactions: record('listReactions', page([])),
		addReaction: record('addReaction', { added: true, comment_id: '99', emoji: ':heart:' }),
		removeReaction: record('removeReaction', {
			deleted: true,
			resource: 'reaction',
			id: ':heart:',
			already_absent: false,
		}),
		...overrides,
	} as unknown as CommentApi
	return { api, calls }
}

/** Run the command as the root program would, capturing what it printed. */
async function run(argv: string[], api: CommentApi, format: string[] = []) {
	const lines: string[] = []
	const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		lines.push(args.join(' '))
	})
	const argvBefore = process.argv
	process.argv = ['node', 'cyber-figma', ...format]
	const command = commentCommand(() => api)
	// The root program installs this on every command, which is what turns a
	// usage mistake into a structured error instead of a process exit.
	installUsageErrors(command)
	try {
		await command.parseAsync(['node', 'cyber-figma', ...argv])
	} finally {
		process.argv = argvBefore
		log.mockRestore()
	}
	return lines.join('\n')
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('comment list', () => {
	it('prints the comments of the file', async () => {
		const { api, calls } = fakeApi()

		const out = await run(['list', 'abc123'], api)

		expect(calls[0].name).toBe('list')
		expect(calls[0].args[0]).toBe('abc123')
		expect(out).toContain('hello')
		expect(out).toContain('ada')
	})

	it('names what was empty rather than printing nothing', async () => {
		const { api } = fakeApi({ list: () => Promise.resolve(page<Comment>([])) })

		expect(await run(['list', 'abc123'], api)).toContain('0 comments found')
	})
})

describe('comment list options', () => {
	it('asks for markdown bodies and one thread when told to', async () => {
		const { api, calls } = fakeApi()

		await run(['list', 'abc123', '--as-md', '--thread', '7'], api)

		expect(calls[0].args[1]).toEqual({ asMarkdown: true, thread: '7' })
	})

	it('emits the whole result through the shared output layer for --json', async () => {
		const { api } = fakeApi()

		const parsed = JSON.parse(await run(['list', 'abc123'], api, ['--json']))

		expect(parsed).toMatchObject({ count: 1, pagination_model: 'none' })
	})

	it('shows which comments are replies and which are resolved', async () => {
		const { api } = fakeApi({
			list: () =>
				Promise.resolve(
					page([
						comment({ id: '1', resolved_at: '2026-02-02T00:00:00Z' }),
						comment({ id: '2', parent_id: '1', order_id: null }),
					]),
				),
		})

		const out = await run(['list', 'abc123'], api)

		expect(out).toMatch(/^1\s+ada\s+resolved/m)
		// the reply names the comment it answers, which the flat list does not
		expect(out).toMatch(/^2\s+ada\s+open\s+1\s/m)
	})
})

describe('comment create', () => {
	it('posts the message and reports the new comment id', async () => {
		const { api, calls } = fakeApi()

		const out = await run(['create', 'abc123', '--message', 'ship it'], api)

		expect(calls[0]).toMatchObject({ name: 'create', args: ['abc123', { message: 'ship it' }] })
		expect(out).toContain('7')
	})

	it('replies to a comment', async () => {
		const { api, calls } = fakeApi()

		await run(['create', 'abc123', '--message', 'agreed', '--reply-to', '7'], api)

		expect(calls[0].args[1]).toMatchObject({ replyTo: '7' })
	})

	it('pins the comment inside a frame from the node id in a URL', async () => {
		const { api, calls } = fakeApi()

		await run(['create', 'abc123', '--message', 'here', '--node-id', '1-23', '--x', '5', '--y', '6'], api)

		expect(calls[0].args[1]).toMatchObject({ anchor: { node_id: '1:23', node_offset: { x: 5, y: 6 } } })
	})

	it('rejects a non-numeric coordinate as a usage error', async () => {
		const { api } = fakeApi()

		await expect(run(['create', 'abc123', '--message', 'here', '--x', 'left'], api)).rejects.toMatchObject({
			code: 'commander.invalidArgument',
		})
	})
})

describe('comment delete', () => {
	it('acknowledges the delete', async () => {
		const { api, calls } = fakeApi()

		const out = await run(['delete', 'abc123', '99'], api)

		expect(calls[0]).toMatchObject({ name: 'remove', args: ['abc123', '99'] })
		expect(out).toContain('Deleted comment 99')
	})

	it('says so when the comment was already gone', async () => {
		const { api } = fakeApi({
			remove: () => Promise.resolve({ deleted: true, resource: 'comment', id: '99', already_absent: true }),
		})

		expect(await run(['delete', 'abc123', '99'], api)).toContain('already deleted')
	})
})

describe('comment reaction', () => {
	it('lists the reactions on a comment', async () => {
		const { api, calls } = fakeApi()

		const out = await run(['reaction', 'list', 'abc123', '99'], api)

		expect(calls[0]).toMatchObject({ name: 'listReactions' })
		expect(out).toContain('0 reactions found')
	})

	it('offers the cursor this endpoint really paginates with', async () => {
		const { api, calls } = fakeApi()

		await run(['reaction', 'list', 'abc123', '99', '--cursor', 'page-2'], api)

		expect(calls[0].args[2]).toMatchObject({ cursor: 'page-2' })
	})

	it('adds a reaction', async () => {
		const { api, calls } = fakeApi()

		const out = await run(['reaction', 'add', 'abc123', '99', '--emoji', ':heart:'], api)

		expect(calls[0]).toMatchObject({ name: 'addReaction', args: ['abc123', '99', ':heart:'] })
		expect(out).toContain(':heart:')
	})

	it('removes a reaction', async () => {
		const { api, calls } = fakeApi()

		const out = await run(['reaction', 'delete', 'abc123', '99', '--emoji', ':heart:'], api)

		expect(calls[0]).toMatchObject({ name: 'removeReaction', args: ['abc123', '99', ':heart:'] })
		expect(out).toContain('Deleted reaction :heart:')
	})
})

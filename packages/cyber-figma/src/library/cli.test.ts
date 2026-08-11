import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishedComponent, PublishedStyle } from '../figma-types.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import type { LibraryApi } from './api.js'
import { libraryCommand } from './cli.js'
import type { PublishedLibraryItem } from './gateway.js'
import { LIBRARY_RESOURCES, type LibraryResource } from './resources.js'

const COMPONENT = LIBRARY_RESOURCES[0] as LibraryResource
const STYLE = LIBRARY_RESOURCES[2] as LibraryResource

const USER = { id: 'u1', handle: 'designer', img_url: 'https://img' }

function component(overrides: Partial<PublishedComponent> = {}): PublishedComponent {
	return {
		key: 'component-key',
		file_key: 'main-file',
		node_id: '1:23',
		name: 'Button/Primary',
		description: 'The primary button',
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-02-02T00:00:00Z',
		user: USER,
		...overrides,
	}
}

function style(): PublishedStyle {
	return {
		key: 'style-key',
		file_key: 'main-file',
		node_id: '2:34',
		style_type: 'TEXT',
		name: 'Heading/H1',
		description: '',
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-02-02T00:00:00Z',
		user: USER,
		sort_position: 'a',
	}
}

function result<T>(data: T[], overrides: Partial<PaginatedResult<T>> = {}): PaginatedResult<T> {
	return {
		data,
		count: data.length,
		next_cursor: null,
		prev_cursor: null,
		pagination_model: 'id_cursor',
		page_count: 1,
		truncated: false,
		...overrides,
	}
}

type Call = { op: string; arg?: string; opts?: PaginationOptions }

function createApiDouble(
	items: PublishedLibraryItem[] = [component()],
	listOverrides: Partial<PaginatedResult<PublishedLibraryItem>> = {},
) {
	const calls: Call[] = []
	const api: LibraryApi = {
		listByTeam: async (team, opts) => {
			calls.push({ op: 'listByTeam', arg: team, opts })
			return result(items, listOverrides)
		},
		listByFile: async (file, opts) => {
			calls.push({ op: 'listByFile', arg: file, opts })
			return result(items, { pagination_model: 'none' })
		},
		get: async (key) => {
			calls.push({ op: 'get', arg: key })
			return items[0] as PublishedLibraryItem
		},
	}
	return { api, calls }
}

function run(resource: LibraryResource, args: string[], api: LibraryApi) {
	return libraryCommand(resource, () => api).parseAsync(args, { from: 'user' })
}

let logged: string[]

beforeEach(() => {
	logged = []
	vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
		logged.push(parts.join(' '))
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

const output = () => logged.join('\n')

describe('the command itself', () => {
	it.each(LIBRARY_RESOURCES)('is named after the Figma resource for $domain', (resource) => {
		expect(libraryCommand(resource, () => createApiDouble().api).name()).toBe(resource.domain)
	})

	// The single most common misreading of these endpoints, so every description
	// carries it rather than leaving a correct empty result looking broken.
	it.each(LIBRARY_RESOURCES)('says published-only in every subcommand description for $domain', (resource) => {
		const cmd = libraryCommand(resource, () => createApiDouble().api)
		const descriptions = cmd.commands.map((sub) => sub.description())

		expect(descriptions).toHaveLength(3)
		for (const description of descriptions) expect(description).toMatch(/published/i)
	})
})

describe('team-list', () => {
	it('lists the published components of the configured team', async () => {
		const { api, calls } = createApiDouble()

		await run(COMPONENT, ['team-list'], api)

		expect(calls[0]).toMatchObject({ op: 'listByTeam' })
		expect(output()).toContain('component-key')
		expect(output()).toContain('Button/Primary')
	})

	// Documented precedence: a command argument outranks --team, which outranks
	// FIGMA_TEAM_ID, which outranks the repo config.
	it('takes an explicit team as its argument', async () => {
		const { api, calls } = createApiDouble()

		await run(COMPONENT, ['team-list', '1234'], api)

		expect(calls[0]?.arg).toBe('1234')
	})

	it('names what was empty rather than printing nothing', async () => {
		const { api } = createApiDouble([])

		await run(COMPONENT, ['team-list'], api)

		expect(output()).toContain('0 components found')
	})

	it('summarizes the count and suggests the next call', async () => {
		const { api } = createApiDouble()

		await run(COMPONENT, ['team-list'], api)

		expect(output()).toContain('1 component(s)')
		expect(output()).toContain('cyber-figma component get')
	})

	it('offers the cursor flags this endpoint actually has', async () => {
		const flags = libraryCommand(COMPONENT, () => createApiDouble().api)
			.commands.find((sub) => sub.name() === 'team-list')
			?.options.map((option) => option.long)

		expect(flags).toEqual(expect.arrayContaining(['--page-size', '--before', '--after', '--all', '--max-pages']))
		expect(flags).not.toContain('--cursor')
	})

	it('hands back the cursor when there are more pages', async () => {
		const { api } = createApiDouble([component()], { next_cursor: '30' })

		await run(COMPONENT, ['team-list'], api)

		expect(output()).toContain('--after 30')
	})

	it('shows the style type, which only the style family has', async () => {
		const { api } = createApiDouble([style()])

		await run(STYLE, ['team-list'], api)

		expect(output()).toContain('TEXT')
	})
})

describe('file-list', () => {
	it('lists the published components of one file', async () => {
		const { api, calls } = createApiDouble()

		await run(COMPONENT, ['file-list', 'https://www.figma.com/design/abc123/DS'], api)

		expect(calls[0]).toMatchObject({ op: 'listByFile', arg: 'https://www.figma.com/design/abc123/DS' })
	})

	it('warns that the key must be a main file key, because branches cannot publish', () => {
		const sub = libraryCommand(COMPONENT, () => createApiDouble().api).commands.find(
			(candidate) => candidate.name() === 'file-list',
		)

		expect(sub?.usage()).toContain('<file>')
		expect(sub?.registeredArguments[0]?.description).toMatch(/main/i)
	})

	it('offers no pagination flags, because the endpoint has none', () => {
		const flags = libraryCommand(COMPONENT, () => createApiDouble().api)
			.commands.find((sub) => sub.name() === 'file-list')
			?.options.map((option) => option.long)

		expect(flags).not.toContain('--page-size')
		expect(flags).not.toContain('--cursor')
	})
})

describe('get', () => {
	it('shows the fields of one published component', async () => {
		const { api, calls } = createApiDouble()

		await run(COMPONENT, ['get', 'component-key'], api)

		expect(calls[0]).toMatchObject({ op: 'get', arg: 'component-key' })
		expect(output()).toContain('Button/Primary')
		expect(output()).toContain('main-file')
	})

	it('truncates a long description unless --full is set', async () => {
		const { api } = createApiDouble([component({ description: 'x'.repeat(900) })])

		await run(COMPONENT, ['get', 'component-key'], api)

		expect(output()).toContain('truncated')
	})
})

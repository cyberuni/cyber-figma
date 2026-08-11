import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VariableApi } from './api.js'
import { variableCommand } from './cli.js'

const VARIABLE = {
	id: 'VariableID:1:2',
	name: 'brand/primary',
	key: 'k',
	variableCollectionId: 'VariableCollectionId:1:1',
	resolvedType: 'COLOR' as const,
	valuesByMode: { '1:0': { r: 1, g: 0, b: 0, a: 1 } },
	remote: false,
	description: 'The primary brand color',
	hiddenFromPublishing: false,
	scopes: [],
	codeSyntax: {},
}

const COLLECTION = {
	id: 'VariableCollectionId:1:1',
	name: 'Brand',
	key: 'ck',
	modes: [{ modeId: '1:0', name: 'Light' }],
	defaultModeId: '1:0',
	remote: false,
	hiddenFromPublishing: false,
	variableIds: ['VariableID:1:2'],
}

function page<T>(data: T[]) {
	return {
		data,
		count: data.length,
		next_cursor: null,
		prev_cursor: null,
		pagination_model: 'none' as const,
		page_count: 1,
		truncated: false,
	}
}

function fakeApi(over: Partial<VariableApi> = {}) {
	return {
		list: vi.fn(async () => page([VARIABLE])),
		collections: vi.fn(async () => page([COLLECTION])),
		get: vi.fn(async () => VARIABLE),
		apply: vi.fn(async () => ({
			temp_id_to_real_id: { tmp: 'VariableID:2:1' },
			changes: { variables: 1 },
			note: 'publish it',
		})),
		validate: vi.fn(() => ({ valid: true as const, changes: { variables: 1 }, note: 'publish it' })),
		...over,
	} as unknown as VariableApi & Record<string, ReturnType<typeof vi.fn>>
}

let logged: string[] = []

beforeEach(() => {
	logged = []
	vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		logged.push(args.join(' '))
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

const out = () => logged.join('\n')

async function run(api: VariableApi, args: string[]) {
	await variableCommand(() => api).parseAsync(args, { from: 'user' })
}

describe('variable list', () => {
	it('prints the variables of a file with their collection and type', async () => {
		const api = fakeApi()

		await run(api, ['list', 'abc123'])

		expect(api.list).toHaveBeenCalledWith('abc123', expect.objectContaining({ published: undefined }))
		expect(out()).toContain('brand/primary')
		expect(out()).toContain('COLOR')
	})

	it('names what was empty rather than printing nothing', async () => {
		await run(fakeApi({ list: vi.fn(async () => page([])) as never }), ['list', 'abc123'])

		expect(out()).toContain('0 variables found')
	})

	it('summarizes the count', async () => {
		await run(fakeApi(), ['list', 'abc123'])

		expect(out()).toContain('1 variable(s)')
	})

	it('suggests what to do next', async () => {
		await run(fakeApi(), ['list', 'abc123'])

		expect(out()).toMatch(/Next steps/)
	})

	it('reads the published view when asked', async () => {
		const api = fakeApi()

		await run(api, ['list', 'abc123', '--published'])

		expect(api.list).toHaveBeenCalledWith('abc123', expect.objectContaining({ published: true }))
	})

	it('passes a collection filter through', async () => {
		const api = fakeApi()

		await run(api, ['list', 'abc123', '--collection', 'VariableCollectionId:1:1'])

		expect(api.list).toHaveBeenCalledWith(
			'abc123',
			expect.objectContaining({ collectionId: 'VariableCollectionId:1:1' }),
		)
	})
})

describe('variable collections', () => {
	it('prints the collections with their modes', async () => {
		await run(fakeApi(), ['collections', 'abc123'])

		expect(out()).toContain('Brand')
		expect(out()).toContain('Light')
	})

	it('names what was empty', async () => {
		await run(fakeApi({ collections: vi.fn(async () => page([])) as never }), ['collections', 'abc123'])

		expect(out()).toContain('0 variable collections found')
	})
})

describe('variable get', () => {
	it('prints the variable a node id resolves to, with its mode values', async () => {
		const api = fakeApi()

		await run(api, ['get', 'abc123', 'VariableID:1:2'])

		expect(api.get).toHaveBeenCalledWith('abc123', 'VariableID:1:2', expect.objectContaining({ published: undefined }))
		expect(out()).toContain('brand/primary')
		expect(out()).toContain('1:0')
	})

	it('truncates a long description by default', async () => {
		const long = { ...VARIABLE, description: 'd'.repeat(900) }

		await run(fakeApi({ get: vi.fn(async () => long) as never }), ['get', 'abc123', 'VariableID:1:2'])

		expect(out()).toContain('truncated')
	})
})

describe('variable apply', () => {
	const changes = { variables: [{ action: 'CREATE', name: 'gap', variableCollectionId: 'c', resolvedType: 'FLOAT' }] }

	it('sends a change set given inline', async () => {
		const api = fakeApi()

		await run(api, ['apply', 'abc123', '--changes', JSON.stringify(changes)])

		expect(api.apply).toHaveBeenCalledWith('abc123', changes)
	})

	it('reads a change set from a file with @path', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'cyber-figma-variables-'))
		const path = join(dir, 'changes.json')
		await writeFile(path, JSON.stringify(changes))
		const api = fakeApi()

		await run(api, ['apply', 'abc123', '--changes', `@${path}`])

		expect(api.apply).toHaveBeenCalledWith('abc123', changes)
	})

	it('names the file and the parse problem when the change set is not JSON', async () => {
		await expect(run(fakeApi(), ['apply', 'abc123', '--changes', '{oops'])).rejects.toThrow(/JSON/)
	})

	it('says which file it could not read', async () => {
		await expect(run(fakeApi(), ['apply', 'abc123', '--changes', '@/no/such/changes.json'])).rejects.toThrow(
			/\/no\/such\/changes.json/,
		)
	})

	it('acknowledges with what changed, the id mapping, and the publish caveat', async () => {
		await run(fakeApi(), ['apply', 'abc123', '--changes', JSON.stringify(changes)])

		expect(out()).toContain('variables')
		expect(out()).toContain('VariableID:2:1')
		expect(out()).toMatch(/publish/i)
	})

	it('checks without sending when asked for a dry run', async () => {
		const api = fakeApi()

		await run(api, ['apply', 'abc123', '--changes', JSON.stringify(changes), '--dry-run'])

		expect(api.validate).toHaveBeenCalledWith(changes)
		expect(api.apply).not.toHaveBeenCalled()
		expect(out()).toMatch(/not sent|dry run/i)
	})
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FigmaApiError } from '../figma-error.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import { setTeamOverride } from '../scope.js'
import { createLibraryApi } from './api.js'
import type { LibraryGateway } from './gateway.js'
import { LIBRARY_RESOURCES } from './resources.js'

type Item = { key: string }

const COMPONENT = LIBRARY_RESOURCES.find((resource) => resource.domain === 'component') as (typeof LIBRARY_RESOURCES)[0]

function emptyResult(): PaginatedResult<Item> {
	return {
		data: [],
		count: 0,
		next_cursor: null,
		prev_cursor: null,
		pagination_model: 'id_cursor',
		page_count: 1,
		truncated: false,
	}
}

type Call = { op: string; id: string; opts?: PaginationOptions }

function createGatewayDouble(failure?: unknown): { gateway: LibraryGateway<Item>; calls: Call[] } {
	const calls: Call[] = []
	const fail = async () => {
		if (failure) throw failure
	}
	return {
		calls,
		gateway: {
			listByTeam: async (teamId, opts) => {
				calls.push({ op: 'listByTeam', id: teamId, opts })
				await fail()
				return emptyResult()
			},
			listByFile: async (fileKey, opts) => {
				calls.push({ op: 'listByFile', id: fileKey, opts })
				await fail()
				return emptyResult()
			},
			get: async (key) => {
				calls.push({ op: 'get', id: key })
				await fail()
				return { key }
			},
		},
	}
}

const originalTeam = process.env.FIGMA_TEAM_ID

beforeEach(() => {
	delete process.env.FIGMA_TEAM_ID
	setTeamOverride(undefined)
})

afterEach(() => {
	setTeamOverride(undefined)
	if (originalTeam !== undefined) process.env.FIGMA_TEAM_ID = originalTeam
	else delete process.env.FIGMA_TEAM_ID
})

describe('listByTeam', () => {
	it('uses the team id it was given', async () => {
		const { gateway, calls } = createGatewayDouble()

		await createLibraryApi(gateway, COMPONENT).listByTeam('1234')

		expect(calls[0]).toMatchObject({ op: 'listByTeam', id: '1234' })
	})

	it('falls back to the configured team when none was given', async () => {
		process.env.FIGMA_TEAM_ID = '9876'
		const { gateway, calls } = createGatewayDouble()

		await createLibraryApi(gateway, COMPONENT).listByTeam()

		expect(calls[0]?.id).toBe('9876')
	})

	it('accepts the team URL a user copies out of the URL bar', async () => {
		const { gateway, calls } = createGatewayDouble()

		await createLibraryApi(gateway, COMPONENT).listByTeam('https://www.figma.com/files/team/1234/Design')

		expect(calls[0]?.id).toBe('1234')
	})

	it('says where to find a team id when none is configured', async () => {
		const { gateway } = createGatewayDouble()

		await expect(createLibraryApi(gateway, COMPONENT).listByTeam()).rejects.toThrowError(/team id/i)
	})

	it('names the scope this endpoint group needs when Figma refuses it', async () => {
		const refusal = new FigmaApiError({ status: 403, method: 'GET', path: '/v1/teams/1234/components' })
		const { gateway } = createGatewayDouble(refusal)

		await expect(createLibraryApi(gateway, COMPONENT).listByTeam('1234')).rejects.toThrowError()
		expect((refusal as FigmaApiError & { hint?: string }).hint).toContain('team_library_content:read')
	})
})

describe('listByFile', () => {
	it('accepts a file URL anywhere a file key is taken', async () => {
		const { gateway, calls } = createGatewayDouble()

		await createLibraryApi(gateway, COMPONENT).listByFile('https://www.figma.com/design/abc123/Design-System')

		expect(calls[0]).toMatchObject({ op: 'listByFile', id: 'abc123' })
	})

	it('names the file scope and the branch trap when Figma refuses it', async () => {
		const refusal = new FigmaApiError({ status: 404, method: 'GET', path: '/v1/files/abc/components' })
		const { gateway } = createGatewayDouble(refusal)

		await expect(createLibraryApi(gateway, COMPONENT).listByFile('abc')).rejects.toThrowError()
		const hint = (refusal as FigmaApiError & { hint?: string }).hint ?? ''
		expect(hint).toContain('library_content:read')
		expect(hint).toMatch(/branch/i)
	})
})

describe('get', () => {
	it('reads a single published item by its library key', async () => {
		const { gateway, calls } = createGatewayDouble()

		await expect(createLibraryApi(gateway, COMPONENT).get('key-1')).resolves.toEqual({ key: 'key-1' })
		expect(calls[0]).toMatchObject({ op: 'get', id: 'key-1' })
	})

	it('explains that a 404 means no published item with that key', async () => {
		const missing = new FigmaApiError({ status: 404, method: 'GET', path: '/v1/components/key-1' })
		const { gateway } = createGatewayDouble(missing)

		await expect(createLibraryApi(gateway, COMPONENT).get('key-1')).rejects.toThrowError()
		const hint = (missing as FigmaApiError & { hint?: string }).hint ?? ''
		expect(hint).toContain('library_assets:read')
		expect(hint).toMatch(/published/i)
	})
})

describe('every family', () => {
	it.each(LIBRARY_RESOURCES)('is servable by the same api for $domain', async (resource) => {
		const { gateway, calls } = createGatewayDouble()
		const api = createLibraryApi(gateway, resource)

		await api.listByTeam('1234')
		await api.listByFile('abc123')
		await api.get('key-1')

		expect(calls.map((call) => call.op)).toEqual(['listByTeam', 'listByFile', 'get'])
	})
})

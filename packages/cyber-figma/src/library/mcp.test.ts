import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import type { LibraryApi } from './api.js'
import { registerLibraryTools } from './mcp.js'
import { LIBRARY_RESOURCES, type LibraryResource } from './resources.js'

type Registered = {
	name: string
	description: string
	schema: Record<string, { description?: string; _def?: unknown }>
	handler: (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
}

function createServerDouble() {
	const tools: Registered[] = []
	const server = {
		tool: (name: string, description: string, schema: Registered['schema'], handler: Registered['handler']) => {
			tools.push({ name, description, schema, handler })
		},
	} as unknown as McpServer
	return { server, tools }
}

type Call = { op: string; arg?: string; opts?: PaginationOptions }

function createApiDouble() {
	const calls: Call[] = []
	const list: PaginatedResult<unknown> = {
		data: [{ key: 'k1' }],
		count: 1,
		next_cursor: null,
		prev_cursor: null,
		pagination_model: 'id_cursor',
		page_count: 1,
		truncated: false,
	}
	const api: LibraryApi<unknown> = {
		listByTeam: async (team, opts) => {
			calls.push({ op: 'listByTeam', arg: team, opts })
			return list
		},
		listByFile: async (file, opts) => {
			calls.push({ op: 'listByFile', arg: file, opts })
			return list
		},
		get: async (key) => {
			calls.push({ op: 'get', arg: key })
			return { key }
		},
	}
	return { api, calls }
}

function registerAll() {
	const { server, tools } = createServerDouble()
	const { api, calls } = createApiDouble()
	for (const resource of LIBRARY_RESOURCES) registerLibraryTools(server, resource, () => api)
	return { tools, calls }
}

function toolFor(resource: LibraryResource, action: string) {
	const { server, tools } = createServerDouble()
	const { api, calls } = createApiDouble()
	registerLibraryTools(server, resource, () => api)
	return { tool: tools.find((candidate) => candidate.name === `figma_${resource.tool}_${action}`) as Registered, calls }
}

const COMPONENT = LIBRARY_RESOURCES[0] as LibraryResource

describe('registerLibraryTools', () => {
	it('registers the three reads of each family under figma_<resource>_<action>', () => {
		expect(registerAll().tools.map((tool) => tool.name)).toEqual([
			'figma_component_team_list',
			'figma_component_file_list',
			'figma_component_get',
			'figma_component_set_team_list',
			'figma_component_set_file_list',
			'figma_component_set_get',
			'figma_style_team_list',
			'figma_style_file_list',
			'figma_style_get',
		])
	})

	// An agent reading the tool listing must not conclude the tool is broken when
	// a file with unpublished components answers empty.
	it('says published-only in every tool description', () => {
		for (const tool of registerAll().tools) expect(tool.description).toMatch(/published/i)
	})

	it('names the scope each tool needs, because they differ per scope of access', () => {
		const { tools } = registerAll()
		const description = (name: string) => tools.find((tool) => tool.name === name)?.description ?? ''

		expect(description('figma_component_team_list')).toContain('team_library_content:read')
		expect(description('figma_component_file_list')).toContain('library_content:read')
		expect(description('figma_component_get')).toContain('library_assets:read')
	})
})

describe('the team list tool', () => {
	it('advertises the parameters this model has, and no cursor', () => {
		const { tool } = toolFor(COMPONENT, 'team_list')

		expect(Object.keys(tool.schema)).toEqual(
			expect.arrayContaining(['team', 'page_size', 'before', 'after', 'fetch_all', 'max_pages']),
		)
		expect(Object.keys(tool.schema)).not.toContain('cursor')
	})

	it('passes the team and the pagination options through and serializes the result', async () => {
		const { tool, calls } = toolFor(COMPONENT, 'team_list')

		const response = await tool.handler({ team: '1234', page_size: 50 })

		expect(calls[0]).toMatchObject({ op: 'listByTeam', arg: '1234' })
		expect(calls[0]?.opts).toMatchObject({ pageSize: 50 })
		expect(JSON.parse(response.content[0].text).data).toEqual([{ key: 'k1' }])
	})
})

describe('the file list tool', () => {
	it('advertises no pagination parameters, because the endpoint has none', () => {
		const { tool } = toolFor(COMPONENT, 'file_list')

		expect(Object.keys(tool.schema)).toEqual(['file'])
	})

	it('warns in the parameter description that a branch key cannot work', () => {
		const { tool } = toolFor(COMPONENT, 'file_list')

		expect(tool.schema.file.description).toMatch(/main/i)
	})

	it('passes the file through', async () => {
		const { tool, calls } = toolFor(COMPONENT, 'file_list')

		await tool.handler({ file: 'https://www.figma.com/design/abc123/DS' })

		expect(calls[0]).toMatchObject({ op: 'listByFile', arg: 'https://www.figma.com/design/abc123/DS' })
	})
})

describe('the get tool', () => {
	it('takes the library key and serializes the item', async () => {
		const { tool, calls } = toolFor(COMPONENT, 'get')

		const response = await tool.handler({ key: 'k1' })

		expect(calls[0]).toMatchObject({ op: 'get', arg: 'k1' })
		expect(JSON.parse(response.content[0].text)).toEqual({ key: 'k1' })
	})
})

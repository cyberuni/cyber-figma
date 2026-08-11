import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'
import type { PaginatedResult } from '../pagination.js'
import type { ProjectApi } from './api.js'
import { registerProjectTools } from './mcp.js'

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

const api: ProjectApi = {
	list: async (team) => page([{ id: '55', name: team ?? 'default' }]),
	get: async (project) => ({
		id: project,
		name: 'Website',
		thumbnail_url: null,
		file_count: 2,
		updated_at: '2026-02-01T00:00:00Z',
		created_at: '2026-01-01T00:00:00Z',
	}),
	files: async () => page([{ key: 'abc123', name: 'Home', last_modified: '2026-02-01T00:00:00Z' }]),
}

type Handler = (params: Record<string, unknown>) => Promise<CallToolResult>

function registered() {
	const tools = new Map<string, Handler>()
	const server = {
		tool(name: string, _description: string, _schema: unknown, handler: Handler) {
			tools.set(name, handler)
		},
	}
	registerProjectTools(server as unknown as McpServer, () => api)
	return tools
}

function payload(result: CallToolResult): unknown {
	const part = result.content[0]
	if (part.type !== 'text') throw new Error('expected text content')
	return JSON.parse(part.text)
}

describe('project tools', () => {
	it('registers one tool per project operation', () => {
		expect([...registered().keys()]).toEqual(['figma_project_list', 'figma_project_get', 'figma_project_files'])
	})

	it('lists the projects of the team it was given', async () => {
		const result = await registered().get('figma_project_list')?.({ team: '1234' })

		expect(payload(result as CallToolResult)).toMatchObject({ data: [{ id: '55', name: '1234' }] })
	})

	it('reads a project by id', async () => {
		const result = await registered().get('figma_project_get')?.({ project: '55' })

		expect(payload(result as CallToolResult)).toMatchObject({ id: '55', file_count: 2 })
	})

	it('lists the files of a project', async () => {
		const result = await registered().get('figma_project_files')?.({ project: '55' })

		expect(payload(result as CallToolResult)).toMatchObject({ data: [{ key: 'abc123' }] })
	})
})

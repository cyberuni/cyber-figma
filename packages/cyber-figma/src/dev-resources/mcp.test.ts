import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { DevResourceApi } from './api.js'
import { registerDevResourceTools } from './mcp.js'
import { summarizeWrite } from './write-result.js'

type Registered = {
	name: string
	schema: Record<string, unknown>
	call: (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
}

function register(api: Partial<DevResourceApi>) {
	const tools: Registered[] = []
	const server = {
		tool: (name: string, _description: string, schema: Record<string, unknown>, call: Registered['call']) => {
			tools.push({ name, schema, call })
		},
	} as unknown as McpServer

	registerDevResourceTools(server, () => api as DevResourceApi)
	return tools
}

const LINK = { id: 'dr-1', name: 'PR', url: 'https://example.com/pr/1', file_key: 'abc123', node_id: '1:2' }

describe('registerDevResourceTools', () => {
	it('registers one tool per Dev Resources endpoint', () => {
		expect(register({}).map((tool) => tool.name)).toEqual([
			'figma_dev_resource_list',
			'figma_dev_resource_create',
			'figma_dev_resource_update',
			'figma_dev_resource_delete',
		])
	})

	// The bulk endpoints are where MCP earns its keep: one call, many links.
	it('creates every link in one call and returns the partial-success report', async () => {
		const tools = register({
			create: async (resources) =>
				summarizeWrite('create', resources.length, [LINK], [{ node_id: '9:9', error: 'Duplicate url' }]),
		})

		const result = await tools[1].call({
			resources: [
				{ file: 'abc123', node_id: '1-2', name: 'PR', url: 'https://example.com/pr/1' },
				{ file: 'abc123', node_id: '9-9', name: 'PR', url: 'https://example.com/pr/1' },
			],
		})

		expect(JSON.parse(result.content[0].text)).toMatchObject({
			ok: false,
			requested: 2,
			succeeded: 1,
			failed: 1,
			errors: [{ node_id: '9:9', error: 'Duplicate url' }],
		})
	})
})

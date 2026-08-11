import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'
import type { OEmbedApi } from './api.js'
import { registerOEmbedTools } from './mcp.js'

type Handler = (params: Record<string, unknown>) => Promise<CallToolResult>

let seen: Record<string, unknown> = {}

const api: OEmbedApi = {
	get: async (url, opts) => {
		seen = { url, ...opts }
		return {
			version: '1.0',
			type: 'rich',
			title: 'Home',
			key: 'abc123',
			url,
			provider_name: 'Figma',
			provider_url: 'https://www.figma.com',
			cache_age: 3600,
			width: 800,
			height: 450,
			html: '<iframe></iframe>',
		}
	},
}

function registered() {
	const tools = new Map<string, Handler>()
	const server = {
		tool(name: string, _description: string, _schema: unknown, handler: Handler) {
			tools.set(name, handler)
		},
	}
	registerOEmbedTools(server as unknown as McpServer, () => api)
	return tools
}

describe('oembed tools', () => {
	it('registers the oEmbed tool', () => {
		expect([...registered().keys()]).toEqual(['figma_oembed_get'])
	})

	it('describes the URL it was given', async () => {
		const result = (await registered().get('figma_oembed_get')?.({
			url: 'https://www.figma.com/design/abc123/Home',
			max_width: 1200,
		})) as CallToolResult
		const part = result.content[0]
		if (part.type !== 'text') throw new Error('expected text content')

		expect(JSON.parse(part.text)).toMatchObject({ title: 'Home', key: 'abc123' })
		expect(seen).toMatchObject({ maxWidth: 1200 })
	})
})

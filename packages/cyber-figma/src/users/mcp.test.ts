import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'
import type { UserApi } from './api.js'
import { registerUserTools } from './mcp.js'

const api: UserApi = {
	me: async () => ({ id: '1', handle: 'ada', img_url: 'https://img', email: 'ada@example.com' }),
}

type Handler = (params: Record<string, unknown>) => Promise<CallToolResult>

function registered() {
	const tools = new Map<string, Handler>()
	const server = {
		tool(name: string, _description: string, _schema: unknown, handler: Handler) {
			tools.set(name, handler)
		},
	}
	registerUserTools(server as unknown as McpServer, () => api)
	return tools
}

describe('user tools', () => {
	it('registers the current-user tool', () => {
		expect([...registered().keys()]).toEqual(['figma_user_me'])
	})

	it('returns the account the credential belongs to', async () => {
		const result = (await registered().get('figma_user_me')?.({})) as CallToolResult
		const part = result.content[0]
		if (part.type !== 'text') throw new Error('expected text content')

		expect(JSON.parse(part.text)).toMatchObject({ handle: 'ada' })
	})
})

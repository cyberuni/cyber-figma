import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { WebhookApi } from './api.js'
import { registerWebhookTools } from './mcp.js'

type Registered = {
	name: string
	description: string
	schema: Record<string, unknown>
	handler: (params: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
}

function register(api: Partial<WebhookApi>) {
	const tools: Registered[] = []
	const server = {
		tool: (name: string, description: string, schema: Record<string, unknown>, handler: Registered['handler']) => {
			tools.push({ name, description, schema, handler })
		},
	} as unknown as McpServer

	registerWebhookTools(server, () => api as WebhookApi)
	return {
		tools,
		byName: (name: string) => tools.find((tool) => tool.name === name),
	}
}

describe('registerWebhookTools', () => {
	it('registers one tool per webhook operation, named figma_webhook_<action>', () => {
		const { tools } = register({})

		expect(tools.map((tool) => tool.name)).toEqual([
			'figma_webhook_list',
			'figma_webhook_get',
			'figma_webhook_create',
			'figma_webhook_update',
			'figma_webhook_delete',
			'figma_webhook_requests',
		])
	})

	it('offers the cursor walking this endpoint actually supports', () => {
		const list = register({}).byName('figma_webhook_list')

		expect(Object.keys(list?.schema ?? {})).toContain('cursor')
		expect(Object.keys(list?.schema ?? {})).not.toContain('page_size')
	})

	it('serializes the result as JSON text', async () => {
		const webhook = { id: 'wh-1' }
		const tools = register({ get: () => Promise.resolve(webhook as never) })

		const result = await tools.byName('figma_webhook_get')?.handler({ webhook_id: 'wh-1' })

		expect(result?.content[0]).toEqual({ type: 'text', text: JSON.stringify(webhook) })
	})

	it('passes the create parameters through under their api names', async () => {
		let received: unknown
		const tools = register({
			create: (input) => {
				received = input
				return Promise.resolve({ id: 'wh-1' } as never)
			},
		})

		await tools.byName('figma_webhook_create')?.handler({
			event_type: 'FILE_UPDATE',
			context: 'file',
			context_id: 'KEY',
			endpoint: 'https://example.com/hook',
			passcode: 'shh',
			status: 'PAUSED',
		})

		expect(received).toMatchObject({
			event: 'FILE_UPDATE',
			context: 'file',
			contextId: 'KEY',
			endpoint: 'https://example.com/hook',
			passcode: 'shh',
			status: 'PAUSED',
		})
	})

	it('tells an agent that an active webhook is pinged on creation', () => {
		expect(register({}).byName('figma_webhook_create')?.description).toMatch(/PING/)
	})

	it('does not expose the endpoint Figma deprecated', () => {
		expect(register({}).byName('figma_webhook_list_team')).toBeUndefined()
	})
})

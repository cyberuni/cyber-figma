import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { ZodTypeAny } from 'zod'
import type { CommentApi } from './api.js'
import { registerCommentTools } from './mcp.js'

type Registered = {
	description: string
	schema: Record<string, ZodTypeAny>
	handler: (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>
}

type Call = { name: string; args: unknown[] }

function register(overrides: Partial<CommentApi> = {}) {
	const calls: Call[] = []
	const record =
		(name: string, result: unknown) =>
		(...args: unknown[]) => {
			calls.push({ name, args })
			return Promise.resolve(result)
		}
	const api = {
		list: record('list', { data: [], count: 0 }),
		create: record('create', { id: '7' }),
		remove: record('remove', { deleted: true }),
		listReactions: record('listReactions', { data: [], count: 0 }),
		addReaction: record('addReaction', { added: true }),
		removeReaction: record('removeReaction', { deleted: true }),
		...overrides,
	} as unknown as CommentApi

	const tools: Record<string, Registered> = {}
	const server = {
		tool: (name: string, description: string, schema: Record<string, ZodTypeAny>, handler: Registered['handler']) => {
			tools[name] = { description, schema, handler }
		},
	} as unknown as McpServer

	registerCommentTools(server, () => api)
	return { tools, calls }
}

describe('registerCommentTools', () => {
	it('registers one tool per Comments and Comment Reactions endpoint', () => {
		expect(Object.keys(register().tools).sort()).toEqual([
			'figma_comment_create',
			'figma_comment_delete',
			'figma_comment_list',
			'figma_comment_reaction_add',
			'figma_comment_reaction_delete',
			'figma_comment_reaction_list',
		])
	})

	it('returns the result as JSON text', async () => {
		const { tools } = register()

		const result = await tools.figma_comment_list.handler({ file: 'abc123' })

		expect(result.content[0]).toEqual({ type: 'text', text: JSON.stringify({ data: [], count: 0 }) })
	})

	it('offers the cursor the reactions endpoint paginates with, and no page_size it does not have', () => {
		const schema = register().tools.figma_comment_reaction_list.schema

		expect(Object.keys(schema)).toContain('cursor')
		expect(Object.keys(schema)).not.toContain('page_size')
	})

	// The comments endpoint returns everything at once, so advertising a cursor
	// would be a lie an MCP client will act on.
	it('advertises no pagination parameters on the comment list', () => {
		const schema = register().tools.figma_comment_list.schema

		expect(Object.keys(schema)).not.toContain('cursor')
	})
})

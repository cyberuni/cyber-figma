import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import type { FileApi } from './api.js'
import { registerFileTools } from './mcp.js'

type Registered = { name: string; description: string; schema: Record<string, unknown>; handler: Handler }
type Handler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>

/** A server stand-in that keeps what was registered, so the tool surface is inspectable. */
function collectTools(api: Partial<FileApi> = {}): Map<string, Registered> {
	const tools = new Map<string, Registered>()
	const server = {
		tool: (name: string, description: string, schema: Record<string, unknown>, handler: Handler) => {
			tools.set(name, { name, description, schema, handler })
		},
	} as unknown as McpServer

	registerFileTools(server, () => api as FileApi)
	return tools
}

describe('file tools', () => {
	it('registers one tool per Files endpoint, named figma_file_<action>', () => {
		expect([...collectTools().keys()].sort()).toEqual([
			'figma_file_get',
			'figma_file_image_fills',
			'figma_file_images',
			'figma_file_meta',
			'figma_file_nodes',
			'figma_file_versions',
		])
	})

	// An agent picks its tool from the description alone, so the tier-1 cost and
	// the cheap alternative have to be in the description rather than the docs.
	it.each(['figma_file_get', 'figma_file_nodes', 'figma_file_images'])('warns that %s is tier 1', (name) => {
		const description = collectTools().get(name)?.description ?? ''

		expect(description).toMatch(/tier 1/)
		expect(description).toContain('figma_file_meta')
	})

	it('tells an agent that a null render url is a per-node outcome', () => {
		expect(collectTools().get('figma_file_images')?.description).toMatch(/null url/i)
	})

	it('advertises only the pagination parameters the versions endpoint has', () => {
		const schema = collectTools().get('figma_file_versions')?.schema ?? {}

		expect(Object.keys(schema)).toContain('page_size')
		expect(Object.keys(schema)).not.toContain('cursor')
	})

	it('serializes what the api returned', async () => {
		const tools = collectTools({ meta: async () => ({ name: 'Design' }) as never })
		const result = await tools.get('figma_file_meta')?.handler({ file: 'abc123' })

		expect(result?.content[0]).toEqual({ type: 'text', text: '{"name":"Design"}' })
	})
})

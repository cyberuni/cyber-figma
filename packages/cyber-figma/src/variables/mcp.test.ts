import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import type { VariableApi } from './api.js'
import { registerVariableTools } from './mcp.js'

type Registration = { name: string; description: string; schema: Record<string, unknown>; handler: Handler }
type Handler = (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>

function registerOn(api: Partial<VariableApi>) {
	const registrations: Registration[] = []
	const server = {
		tool: (name: string, description: string, schema: Record<string, unknown>, handler: Handler) => {
			registrations.push({ name, description, schema, handler })
		},
	} as unknown as McpServer

	registerVariableTools(server, () => api as VariableApi)

	return {
		names: registrations.map((registration) => registration.name),
		tool: (name: string) => {
			const found = registrations.find((registration) => registration.name === name)
			if (!found) throw new Error(`No tool named ${name}. Registered: ${registrations.map((r) => r.name).join(', ')}`)
			return found
		},
	}
}

const result = async (tool: Registration, args: Record<string, unknown>) =>
	JSON.parse((await tool.handler(args)).content[0].text)

describe('registration', () => {
	it('registers one tool per operation, named figma_variable_*', () => {
		expect(registerOn({}).names).toEqual([
			'figma_variable_list',
			'figma_variable_collection_list',
			'figma_variable_get',
			'figma_variable_apply',
		])
	})

	it('says in every description that this is Enterprise-only, so a client does not try it blind', () => {
		const { names, tool } = registerOn({})

		for (const name of names) expect(tool(name).description).toMatch(/Enterprise/)
	})
})

describe('figma_variable_list', () => {
	it('returns the variables of a file as JSON', async () => {
		const list = vi.fn(async () => ({ data: [{ id: 'VariableID:1:2' }] }))
		const { tool } = registerOn({ list: list as never })

		expect(await result(tool('figma_variable_list'), { file: 'abc123' })).toEqual({ data: [{ id: 'VariableID:1:2' }] })
		expect(list).toHaveBeenCalledWith('abc123', expect.objectContaining({ published: undefined }))
	})

	it('passes the published view and the collection filter through', async () => {
		const list = vi.fn(async () => ({ data: [] }))
		const { tool } = registerOn({ list: list as never })

		await result(tool('figma_variable_list'), { file: 'abc123', published: true, collection_id: 'c' })

		expect(list).toHaveBeenCalledWith('abc123', expect.objectContaining({ published: true, collectionId: 'c' }))
	})
})

describe('figma_variable_get', () => {
	it('resolves a variable id', async () => {
		const get = vi.fn(async () => ({ id: 'VariableID:1:2', name: 'brand/primary' }))
		const { tool } = registerOn({ get: get as never })

		expect(await result(tool('figma_variable_get'), { file: 'abc123', variable_id: 'VariableID:1:2' })).toMatchObject({
			name: 'brand/primary',
		})
	})
})

describe('figma_variable_apply', () => {
	const changes = { variables: [{ action: 'CREATE', name: 'gap', variableCollectionId: 'c', resolvedType: 'FLOAT' }] }

	it('sends the change set and returns the id mapping', async () => {
		const apply = vi.fn(async () => ({ temp_id_to_real_id: { tmp: 'VariableID:2:1' }, changes: {}, note: 'publish' }))
		const { tool } = registerOn({ apply: apply as never })

		const body = await result(tool('figma_variable_apply'), { file: 'abc123', changes })

		expect(apply).toHaveBeenCalledWith('abc123', changes)
		expect(body.temp_id_to_real_id).toEqual({ tmp: 'VariableID:2:1' })
	})

	it('validates without sending on a dry run', async () => {
		const apply = vi.fn()
		const validate = vi.fn(() => ({ valid: true, changes: { variables: 1 }, note: 'publish' }))
		const { tool } = registerOn({ apply: apply as never, validate: validate as never })

		const body = await result(tool('figma_variable_apply'), { file: 'abc123', changes, dry_run: true })

		expect(validate).toHaveBeenCalledWith(changes)
		expect(apply).not.toHaveBeenCalled()
		expect(body.dry_run).toBe(true)
	})
})

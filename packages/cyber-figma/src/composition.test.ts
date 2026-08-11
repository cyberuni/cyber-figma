import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Command } from 'commander'
import { describe, expect, it, vi } from 'vitest'
import type { FigmaClient } from './client.js'
import { createRuntimeContext, defineDomain, registerCliCommands, registerMcpTools } from './composition.js'

const client = { request: vi.fn(), authMode: 'personal' } as unknown as FigmaClient

/** A stand-in for what a domain pod ships: an api, a command, and tools. */
function fakeDomain(name: string, calls: string[] = []) {
	return defineDomain({
		name,
		createApi: (c: FigmaClient) => {
			calls.push(`createApi:${name}`)
			return { client: c, list: async () => [name] }
		},
		command: (getApi) =>
			new Command(name).action(async () => {
				calls.push(`run:${name}:${(await getApi().list()).join()}`)
			}),
		registerTools: (server, getApi) => {
			server.tool(`figma_${name}_list`, async () => ({
				content: [{ type: 'text' as const, text: JSON.stringify(await getApi().list()) }],
			}))
		},
	})
}

describe('createRuntimeContext', () => {
	it('exposes the client it was built with', () => {
		expect(createRuntimeContext({ client }).client).toBe(client)
	})

	// A CLI invocation touches one domain; building every domain's api eagerly
	// would pay for all of them on every run.
	it('builds a domain api only when something asks for it', () => {
		const calls: string[] = []
		const context = createRuntimeContext({ client, domains: [fakeDomain('file', calls)] })

		expect(calls).toEqual([])
		context.api('file')
		expect(calls).toEqual(['createApi:file'])
	})

	it('builds each domain api at most once', () => {
		const calls: string[] = []
		const context = createRuntimeContext({ client, domains: [fakeDomain('file', calls)] })

		expect(context.api('file')).toBe(context.api('file'))
		expect(calls).toEqual(['createApi:file'])
	})

	it('refuses to hand out an api for a domain that is not registered', () => {
		expect(() => createRuntimeContext({ client }).api('nope')).toThrowError(/nope/)
	})
})

describe('registerCliCommands', () => {
	it('adds one subcommand per registered domain', () => {
		const program = new Command()
		const domains = [fakeDomain('file'), fakeDomain('comment')]
		registerCliCommands(program, () => createRuntimeContext({ client, domains }), domains)

		expect(program.commands.map((c) => c.name())).toEqual(['file', 'comment'])
	})

	it('gives each command the api of its own domain', async () => {
		const calls: string[] = []
		const program = new Command()
		const domains = [fakeDomain('file', calls)]
		const context = createRuntimeContext({ client, domains })
		registerCliCommands(program, () => context, domains)

		await program.parseAsync(['node', 'cyber-figma', 'file'])

		expect(calls).toContain('run:file:file')
	})

	// The context is resolved when a command runs, not when it is registered, so
	// --help and usage errors never need a credential.
	it('registers without building a runtime context', () => {
		const program = new Command()
		expect(() =>
			registerCliCommands(program, () => {
				throw new Error('should not be called during registration')
			}, [fakeDomain('file')]),
		).not.toThrow()
	})
})

describe('registerMcpTools', () => {
	it('registers each domain tools against its own api', async () => {
		const registered: Record<string, () => Promise<{ content: { text: string }[] }>> = {}
		const server = {
			tool: (name: string, ...rest: unknown[]) => {
				registered[name] = rest.at(-1) as () => Promise<{ content: { text: string }[] }>
			},
		} as unknown as McpServer
		const domains = [fakeDomain('file')]
		const context = createRuntimeContext({ client, domains })

		registerMcpTools(server, () => context, domains)

		expect(Object.keys(registered)).toEqual(['figma_file_list'])
		expect((await registered.figma_file_list()).content[0].text).toBe('["file"]')
	})
})

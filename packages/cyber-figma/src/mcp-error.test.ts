import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it } from 'vitest'
import { FigmaApiError } from './figma-error.js'
import { formatMcpToolError, withMcpErrorHandling } from './mcp-error.js'

function textOf(result: { content?: unknown }) {
	const [part] = (result.content ?? []) as { type: string; text: string }[]
	return part.text
}

describe('formatMcpToolError', () => {
	it('marks the result as an error and serializes the structured body', () => {
		const result = formatMcpToolError(new FigmaApiError({ status: 404, method: 'GET', path: '/v1/files/abc' }))

		expect(result.isError).toBe(true)
		expect(JSON.parse(textOf(result))).toMatchObject({ ok: false, error: { reason: 'not_found', status: 404 } })
	})

	it('carries the hint through so an MCP client sees the same guidance as the CLI', () => {
		const result = formatMcpToolError(
			new FigmaApiError({ status: 403, method: 'GET', path: '/v1/files/abc/variables/local' }),
		)

		expect(JSON.parse(textOf(result)).error.hint).toContain('Enterprise')
	})
})

// A tool that throws must not take the server down or surface a raw stack to
// the client — the wrapper is installed once at registration rather than in
// every tool callback, so it wraps whatever callback the tool was registered
// with, whichever registration overload was used.
describe('withMcpErrorHandling', () => {
	/** A stand-in for McpServer that just records what `tool` was handed. */
	function recordingServer() {
		const registered: Record<string, (args: unknown) => Promise<unknown>> = {}
		const server = {
			tool: (name: string, ...rest: unknown[]) => {
				registered[name] = rest.at(-1) as (args: unknown) => Promise<unknown>
			},
		}
		return { server, registered }
	}

	it('turns a throwing tool into a structured error result', async () => {
		const { server, registered } = recordingServer()
		withMcpErrorHandling(server as unknown as McpServer).tool('figma_file_get', async () => {
			throw new FigmaApiError({ status: 429, method: 'GET', path: '/v1/files/abc' })
		})

		const result = (await registered.figma_file_get({})) as { isError?: boolean; content?: unknown }

		expect(result.isError).toBe(true)
		expect(JSON.parse(textOf(result)).error.reason).toBe('rate_limited')
	})

	it('leaves a successful tool result untouched', async () => {
		const { server, registered } = recordingServer()
		withMcpErrorHandling(server as unknown as McpServer).tool('figma_file_meta', async () => ({
			content: [{ type: 'text' as const, text: '{"ok":true}' }],
		}))

		expect(textOf((await registered.figma_file_meta({})) as { content?: unknown })).toBe('{"ok":true}')
	})

	it('wraps the callback of a registration that also carries a schema', async () => {
		const { server, registered } = recordingServer()
		withMcpErrorHandling(server as unknown as McpServer).tool('figma_comment_list', 'List comments', {}, async () => {
			throw new Error('kaboom')
		})

		expect(((await registered.figma_comment_list({})) as { isError?: boolean }).isError).toBe(true)
	})
})

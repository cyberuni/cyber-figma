import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OEmbedApi } from './api.js'
import { oembedCommand } from './cli.js'

const EMBED = {
	version: '1.0',
	type: 'rich',
	title: 'Home',
	key: 'abc123',
	url: 'https://www.figma.com/design/abc123/Home',
	provider_name: 'Figma',
	provider_url: 'https://www.figma.com',
	cache_age: 3600,
	width: 800,
	height: 450,
	html: '<iframe src="https://www.figma.com/embed"></iframe>',
}

let printed: string[]
let seen: { url?: string; maxWidth?: number; maxHeight?: number }

beforeEach(() => {
	printed = []
	seen = {}
	vi.spyOn(console, 'log').mockImplementation((line?: unknown) => {
		printed.push(String(line))
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

const api: OEmbedApi = {
	get: async (url, opts) => {
		seen = { url, ...opts }
		return EMBED
	},
}

const run = (args: string[]) => oembedCommand(() => api).parseAsync(args, { from: 'user' })

describe('oembed get', () => {
	it('shows the embed metadata of a Figma URL', async () => {
		await run(['get', 'https://www.figma.com/design/abc123/Home'])

		expect(printed.join('\n')).toContain('Home')
	})

	it('points at the file commands, since the response carries the file key', async () => {
		await run(['get', 'https://www.figma.com/design/abc123/Home'])

		expect(printed.join('\n')).toContain('cyber-figma file get abc123')
	})

	it('passes the requested embed dimensions through', async () => {
		await run(['get', 'https://www.figma.com/design/abc123/Home', '--max-width', '1200', '--max-height', '675'])

		expect(seen).toMatchObject({ maxWidth: 1200, maxHeight: 675 })
	})
})

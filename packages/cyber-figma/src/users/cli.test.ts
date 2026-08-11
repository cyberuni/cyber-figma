import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserApi } from './api.js'
import { userCommand } from './cli.js'

const api: UserApi = {
	me: async () => ({ id: '1', handle: 'ada', img_url: 'https://img', email: 'ada@example.com' }),
}

let printed: string[]

beforeEach(() => {
	printed = []
	vi.spyOn(console, 'log').mockImplementation((line?: unknown) => {
		printed.push(String(line))
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

const run = (args: string[]) => userCommand(() => api).parseAsync(args, { from: 'user' })

describe('user me', () => {
	it('identifies the account the credential belongs to', async () => {
		await run(['me'])

		expect(printed.join('\n')).toContain('ada@example.com')
	})

	it('points at the discovery walk, which needs a team id the API cannot supply', async () => {
		await run(['me'])

		expect(printed.join('\n')).toContain('cyber-figma project list')
	})
})

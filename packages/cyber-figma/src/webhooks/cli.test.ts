import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WebhookV2 } from '../figma-types.js'
import type { WebhookApi } from './api.js'
import { webhookCommand } from './cli.js'

const WEBHOOK = {
	id: 'wh-1',
	event_type: 'FILE_UPDATE',
	team_id: '123',
	context: 'FILE',
	context_id: 'FILEKEY',
	plan_api_id: 'team-123',
	status: 'ACTIVE',
	client_id: null,
	passcode: '',
	endpoint: 'https://example.com/hook',
	description: 'nightly',
} as WebhookV2

function fakeApi(overrides: Partial<WebhookApi> = {}) {
	const calls: Record<string, unknown[]> = {}
	const record =
		<T>(name: string, result: T) =>
		(...args: unknown[]) => {
			calls[name] = args
			return Promise.resolve(result)
		}
	const api = {
		list: record('list', {
			data: [WEBHOOK],
			count: 1,
			next_cursor: null,
			prev_cursor: null,
			pagination_model: 'url_cursor',
			page_count: 1,
			truncated: false,
		}),
		listByTeam: record('listByTeam', [WEBHOOK]),
		get: record('get', WEBHOOK),
		create: record('create', WEBHOOK),
		update: record('update', WEBHOOK),
		remove: record('remove', { deleted: true, resource: 'webhook', id: 'wh-1', already_absent: true }),
		requests: record('requests', []),
		...overrides,
	} as unknown as WebhookApi
	return { api, calls }
}

async function run(api: WebhookApi, args: string[]) {
	const log = vi.spyOn(console, 'log').mockImplementation(() => {})
	try {
		await webhookCommand(() => api).parseAsync(args, { from: 'user' })
		return log.mock.calls.map((call) => call.join(' ')).join('\n')
	} finally {
		log.mockRestore()
	}
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('webhook list', () => {
	it('names what was empty rather than printing nothing', async () => {
		const { api } = fakeApi({
			list: () =>
				Promise.resolve({
					data: [],
					count: 0,
					next_cursor: null,
					prev_cursor: null,
					pagination_model: 'url_cursor',
					page_count: 1,
					truncated: false,
				}),
		})

		expect(await run(api, ['list'])).toContain('0 webhooks found')
	})

	it('lists the fields a caller needs to act on, and counts them', async () => {
		const { api } = fakeApi()

		const out = await run(api, ['list'])

		expect(out).toContain('wh-1')
		expect(out).toContain('FILE_UPDATE')
		expect(out).toContain('1 webhook(s)')
	})

	it('passes the context through to the api', async () => {
		const { api, calls } = fakeApi()

		await run(api, ['list', '--context', 'project', '--context-id', '42'])

		expect(calls.list?.[0]).toMatchObject({ context: 'project', contextId: '42' })
	})
})

describe('webhook create', () => {
	it('reads the passcode from the environment variable it was pointed at', async () => {
		vi.stubEnv('MY_HOOK_PASSCODE', 'from-the-environment')
		const { api, calls } = fakeApi()

		const out = await run(api, [
			'create',
			'--event',
			'FILE_UPDATE',
			'--context',
			'file',
			'--context-id',
			'FILEKEY',
			'--endpoint',
			'https://example.com/hook',
			'--passcode-env',
			'MY_HOOK_PASSCODE',
		])

		expect(calls.create?.[0]).toMatchObject({ passcode: 'from-the-environment' })
		expect(out).not.toContain('from-the-environment')
	})

	it('says which variable was empty rather than sending an empty passcode', async () => {
		const { api } = fakeApi()

		await expect(
			run(api, [
				'create',
				'--event',
				'FILE_UPDATE',
				'--context',
				'file',
				'--context-id',
				'FILEKEY',
				'--endpoint',
				'https://example.com/hook',
				'--passcode-env',
				'UNSET_HOOK_PASSCODE',
			]),
		).rejects.toThrow(/UNSET_HOOK_PASSCODE/)
	})

	it('refuses to invent a passcode when neither source is given', async () => {
		const { api } = fakeApi()

		await expect(
			run(api, [
				'create',
				'--event',
				'FILE_UPDATE',
				'--context',
				'file',
				'--context-id',
				'FILEKEY',
				'--endpoint',
				'https://example.com/hook',
			]),
		).rejects.toThrow(/--passcode/)
	})

	it('warns that an active webhook is pinged the moment it is created', async () => {
		const { api } = fakeApi()

		const out = await run(api, [
			'create',
			'--event',
			'FILE_UPDATE',
			'--context',
			'file',
			'--context-id',
			'FILEKEY',
			'--endpoint',
			'https://example.com/hook',
			'--passcode',
			'shh',
		])

		expect(out).toMatch(/PING/)
	})
})

describe('webhook delete', () => {
	it('reports a webhook that was already gone as deleted', async () => {
		const { api } = fakeApi()

		expect(await run(api, ['delete', 'wh-1'])).toContain('already deleted')
	})
})

describe('webhook requests', () => {
	it('names the empty state of a webhook that has received nothing', async () => {
		const { api } = fakeApi()

		expect(await run(api, ['requests', 'wh-1'])).toContain('0 webhook requests found')
	})

	it('separates failed deliveries from successful ones', async () => {
		const delivery = (error: string | null) => ({
			webhook_id: 'wh-1',
			request_info: { id: 'wh-1', endpoint: 'https://example.com/hook', payload: {}, sent_at: '2026-08-11T00:00:00Z' },
			response_info: { status: 200 },
			error_msg: error,
		})
		const { api } = fakeApi({ requests: () => Promise.resolve([delivery(null), delivery('ETIMEDOUT')]) })

		const out = await run(api, ['requests', 'wh-1'])

		expect(out).toContain('1 failed')
		expect(out).toContain('ETIMEDOUT')
	})
})

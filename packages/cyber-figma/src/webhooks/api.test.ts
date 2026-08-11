import { afterEach, describe, expect, it, vi } from 'vitest'
import { FigmaApiError } from '../figma-error.js'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createWebhookApi, REDACTED_PASSCODE } from './api.js'
import { createFigmaWebhookGateway } from './gateway.js'

function apiWith(responses: unknown[]) {
	const client = createRecordingClient(responses)
	return { client, api: createWebhookApi(createFigmaWebhookGateway(client)) }
}

const WEBHOOK = {
	id: 'w1',
	event_type: 'FILE_UPDATE',
	team_id: '123',
	context: 'FILE',
	context_id: 'abc',
	plan_api_id: 'team-123',
	status: 'ACTIVE',
	client_id: null,
	passcode: 'super-secret',
	endpoint: 'https://example.com/hook',
	description: null,
}

const CREATE_INPUT = {
	event: 'FILE_UPDATE',
	context: 'file',
	contextId: 'abc',
	endpoint: 'https://example.com/hook',
	passcode: 'super-secret',
}

function forbidden() {
	return new FigmaApiError({ status: 403, method: 'POST', path: '/v2/webhooks' })
}

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('list', () => {
	it('defaults to the configured team when no context is given', async () => {
		vi.stubEnv('FIGMA_TEAM_ID', '999')
		const { client, api } = apiWith([{ webhooks: [] }])

		await api.list()

		expect(client.requests[0]?.query).toMatchObject({ context: 'team', context_id: '999' })
	})

	it('takes the context id out of a pasted Figma URL', async () => {
		const { client, api } = apiWith([{ webhooks: [] }])

		await api.list({ context: 'file', contextId: 'https://www.figma.com/design/KEY123/Design' })

		expect(client.requests[0]?.query).toMatchObject({ context: 'file', context_id: 'KEY123' })
	})

	it('refuses a context id and a plan id together, because Figma treats them as exclusive', async () => {
		const { api } = apiWith([])

		await expect(api.list({ context: 'team', contextId: '1', plan: 'team-1' })).rejects.toThrow(/mutually exclusive/i)
	})

	it('refuses a plan id that is not a constructed plan api id', async () => {
		const { api } = apiWith([])

		await expect(api.list({ plan: '123456' })).rejects.toThrow(/team-<teamId>/)
	})

	it('returns the uniform paginated result', async () => {
		const { api } = apiWith([{ webhooks: [WEBHOOK] }])

		const result = await api.list({ plan: 'team-123' })

		expect(result).toMatchObject({ count: 1, pagination_model: 'url_cursor', next_cursor: null })
	})

	it('never lets a passcode reach the caller in plaintext', async () => {
		const { api } = apiWith([{ webhooks: [WEBHOOK] }])

		const result = await api.list({ plan: 'team-123' })

		expect(result.data[0]?.passcode).toBe(REDACTED_PASSCODE)
	})
})

describe('listByTeam', () => {
	it('reads the deprecated team endpoint and redacts the same way', async () => {
		const { client, api } = apiWith([{ webhooks: [WEBHOOK] }])

		const webhooks = await api.listByTeam('123')

		expect(client.requests[0]?.path).toBe('/v2/teams/123/webhooks')
		expect(webhooks[0]?.passcode).toBe(REDACTED_PASSCODE)
	})

	it('falls back to the configured team id', async () => {
		vi.stubEnv('FIGMA_TEAM_ID', '777')
		const { client, api } = apiWith([{ webhooks: [] }])

		await api.listByTeam()

		expect(client.requests[0]?.path).toBe('/v2/teams/777/webhooks')
	})
})

describe('get', () => {
	it('redacts the passcode of a single webhook', async () => {
		const { api } = apiWith([WEBHOOK])

		expect((await api.get('w1')).passcode).toBe(REDACTED_PASSCODE)
	})
})

describe('create', () => {
	it('sends the whole documented body', async () => {
		const { client, api } = apiWith([WEBHOOK])

		await api.create({ ...CREATE_INPUT, status: 'paused', description: 'nightly sync' })

		expect(client.requests[0]?.body).toEqual({
			event_type: 'FILE_UPDATE',
			context: 'file',
			context_id: 'abc',
			endpoint: 'https://example.com/hook',
			passcode: 'super-secret',
			status: 'PAUSED',
			description: 'nightly sync',
		})
	})

	it('accepts an event type in any case', async () => {
		const { client, api } = apiWith([WEBHOOK])

		await api.create({ ...CREATE_INPUT, event: 'file_comment' })

		expect(client.requests[0]?.body).toMatchObject({ event_type: 'FILE_COMMENT' })
	})

	it('names every event type when given one Figma does not have', async () => {
		const { api } = apiWith([])

		await expect(api.create({ ...CREATE_INPUT, event: 'FILE_CHANGED' })).rejects.toThrow(
			/FILE_UPDATE.*FILE_VERSION_UPDATE.*DEV_MODE_STATUS_UPDATE/s,
		)
	})

	it('refuses a plain-HTTP endpoint, which Figma answers with a 403', async () => {
		const { api } = apiWith([])

		await expect(api.create({ ...CREATE_INPUT, endpoint: 'http://example.com/hook' })).rejects.toThrow(/https/i)
	})

	it('refuses an endpoint over the documented 2048-character limit', async () => {
		const { api } = apiWith([])
		const endpoint = `https://example.com/${'a'.repeat(2048)}`

		await expect(api.create({ ...CREATE_INPUT, endpoint })).rejects.toThrow(/2048/)
	})

	it('refuses a passcode over the documented 100-character limit', async () => {
		const { api } = apiWith([])

		await expect(api.create({ ...CREATE_INPUT, passcode: 'p'.repeat(101) })).rejects.toThrow(/100/)
	})

	it('requires a passcode, since Figma echoes it back as the only proof the caller is Figma', async () => {
		const { api } = apiWith([])

		await expect(api.create({ ...CREATE_INPUT, passcode: '' })).rejects.toThrow(/passcode/i)
	})

	it('resolves a team context id from the configured team', async () => {
		vi.stubEnv('FIGMA_TEAM_ID', '555')
		const { client, api } = apiWith([WEBHOOK])

		await api.create({ ...CREATE_INPUT, context: 'team', contextId: undefined })

		expect(client.requests[0]?.body).toMatchObject({ context: 'team', context_id: '555' })
	})

	it('redacts the passcode Figma echoes back in the create response', async () => {
		const { api } = apiWith([WEBHOOK])

		expect((await api.create(CREATE_INPUT)).passcode).toBe(REDACTED_PASSCODE)
	})

	it('names the role a file context requires when Figma refuses', async () => {
		const { api } = apiWith([forbidden()])

		await expect(api.create(CREATE_INPUT)).rejects.toMatchObject({
			hint: expect.stringContaining('Can edit'),
		})
	})

	it('names the team-admin requirement when the context is a team', async () => {
		const { api } = apiWith([forbidden()])

		await expect(api.create({ ...CREATE_INPUT, context: 'team', contextId: '1' })).rejects.toMatchObject({
			hint: expect.stringContaining('team admin'),
		})
	})

	it('mentions the per-context webhook cap, which is refused the same way', async () => {
		const { api } = apiWith([forbidden()])

		await expect(api.create({ ...CREATE_INPUT, context: 'project', contextId: '1' })).rejects.toMatchObject({
			hint: expect.stringContaining('5 per project'),
		})
	})

	it('leaves an unrelated failure to the spine', async () => {
		const { api } = apiWith([new FigmaApiError({ status: 404, method: 'POST', path: '/v2/webhooks' })])

		const error = await api.create(CREATE_INPUT).catch((thrown: unknown) => thrown)

		expect(error).toMatchObject({ status: 404 })
		expect(error).not.toHaveProperty('hint')
	})
})

describe('update', () => {
	it('sends only the fields the PUT body accepts', async () => {
		const { client, api } = apiWith([WEBHOOK])

		await api.update('w1', {
			event: 'PING',
			endpoint: 'https://example.com/hook',
			passcode: 'super-secret',
			status: 'active',
		})

		expect(client.requests[0]).toMatchObject({
			method: 'PUT',
			body: {
				event_type: 'PING',
				endpoint: 'https://example.com/hook',
				passcode: 'super-secret',
				status: 'ACTIVE',
			},
		})
		expect(client.requests[0]?.body).not.toHaveProperty('context')
	})

	it('validates the endpoint the same way create does', async () => {
		const { api } = apiWith([])

		await expect(api.update('w1', { event: 'PING', endpoint: 'ftp://example.com', passcode: 'p' })).rejects.toThrow(
			/https/i,
		)
	})
})

describe('remove', () => {
	it('reports a delete', async () => {
		const { api } = apiWith([WEBHOOK])

		expect(await api.remove('w1')).toEqual({
			deleted: true,
			resource: 'webhook',
			id: 'w1',
			already_absent: false,
		})
	})

	it('treats an already-deleted webhook as the state the caller asked for', async () => {
		const { api } = apiWith([new FigmaApiError({ status: 404, method: 'DELETE', path: '/v2/webhooks/w1' })])

		expect(await api.remove('w1')).toMatchObject({ already_absent: true })
	})
})

describe('requests', () => {
	it('returns the deliveries of the last week', async () => {
		const delivery = {
			webhook_id: 'w1',
			request_info: { id: 'w1', endpoint: 'https://example.com/hook', payload: {}, sent_at: '2026-08-11T00:00:00Z' },
			response_info: { status: 200 },
			error_msg: null,
		}
		const { api } = apiWith([{ requests: [delivery] }])

		expect(await api.requests('w1')).toEqual([delivery])
	})
})

describe('summarizeWebhookRequests', () => {
	it('separates the deliveries that failed from the ones that did not', async () => {
		const { summarizeWebhookRequests } = await import('./api.js')

		expect(
			summarizeWebhookRequests([
				{ error_msg: null } as never,
				{ error_msg: 'connect ETIMEDOUT' } as never,
				{ error_msg: 'connect ETIMEDOUT' } as never,
			]),
		).toEqual({ total: 3, failed: 2, delivered: 1 })
	})
})

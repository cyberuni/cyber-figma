import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	createClient,
	createFigmaClient,
	floatParam,
	getTokenOverride,
	setAuthModeOverride,
	setTokenOverride,
} from './client.js'
import { FigmaApiError } from './figma-error.js'

type Call = { url: string; init: RequestInit }

function stubFetch(responses: Response[] | Response) {
	const queue = Array.isArray(responses) ? [...responses] : [responses]
	const calls: Call[] = []
	const fetchStub = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
		calls.push({ url: String(url), init })
		return queue.shift() ?? new Response('{}', { status: 200 })
	})
	return { fetchStub: fetchStub as unknown as typeof fetch, calls }
}

function json(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init,
	})
}

function headerOf(call: Call, name: string) {
	return new Headers(call.init.headers).get(name)
}

const MANAGED = ['FIGMA_ACCESS_TOKEN', 'FIGMA_TOKEN', 'FIGMA_API_BASE_URL', 'FIGMA_AUTH_MODE'] as const
const original = Object.fromEntries(MANAGED.map((name) => [name, process.env[name]]))

beforeEach(() => {
	for (const name of MANAGED) delete process.env[name]
})

afterEach(() => {
	for (const name of MANAGED) {
		const value = original[name]
		if (value !== undefined) process.env[name] = value
		else delete process.env[name]
	}
	setTokenOverride(undefined)
	setAuthModeOverride(undefined)
})

describe('createFigmaClient transport', () => {
	it('calls the Figma API base URL with the given path', async () => {
		const { fetchStub, calls } = stubFetch(json({ name: 'Design' }))
		const client = createFigmaClient({ token: 't', fetch: fetchStub })

		await client.request({ method: 'GET', path: '/v1/files/abc' })

		expect(calls[0].url).toBe('https://api.figma.com/v1/files/abc')
	})

	it('returns the parsed JSON body', async () => {
		const { fetchStub } = stubFetch(json({ name: 'Design' }))
		const client = createFigmaClient({ token: 't', fetch: fetchStub })

		await expect(client.request({ method: 'GET', path: '/v1/files/abc' })).resolves.toEqual({ name: 'Design' })
	})

	it('honors a base URL override so Figma for Government can be reached', async () => {
		const { fetchStub, calls } = stubFetch(json({}))
		const client = createFigmaClient({ token: 't', fetch: fetchStub, baseUrl: 'https://api.figma-gov.com' })

		await client.request({ method: 'GET', path: '/v1/me' })

		expect(calls[0].url).toBe('https://api.figma-gov.com/v1/me')
	})

	it('sends a JSON body on a mutation', async () => {
		const { fetchStub, calls } = stubFetch(json({}))
		const client = createFigmaClient({ token: 't', fetch: fetchStub })

		await client.request({ method: 'POST', path: '/v1/files/abc/comments', body: { message: 'hi' } })

		expect(calls[0].init.method).toBe('POST')
		expect(calls[0].init.body).toBe('{"message":"hi"}')
		expect(headerOf(calls[0], 'content-type')).toBe('application/json')
	})

	it('returns undefined for an empty 204 response', async () => {
		const { fetchStub } = stubFetch(new Response(null, { status: 204 }))
		const client = createFigmaClient({ token: 't', fetch: fetchStub })

		await expect(client.request({ method: 'DELETE', path: '/v1/files/abc/dev_resources/1' })).resolves.toBeUndefined()
	})
})

describe('createFigmaClient authentication', () => {
	it('sends a personal access token in the X-Figma-Token header', async () => {
		const { fetchStub, calls } = stubFetch(json({}))
		await createFigmaClient({ token: 'pat', fetch: fetchStub }).request({ method: 'GET', path: '/v1/me' })

		expect(headerOf(calls[0], 'x-figma-token')).toBe('pat')
		expect(headerOf(calls[0], 'authorization')).toBeNull()
	})

	it('sends a plan access token in the X-Figma-Token header too', async () => {
		const { fetchStub, calls } = stubFetch(json({}))
		await createFigmaClient({ token: 'plan', authMode: 'plan', fetch: fetchStub }).request({
			method: 'GET',
			path: '/v1/activity_logs',
		})

		expect(headerOf(calls[0], 'x-figma-token')).toBe('plan')
	})

	it('sends an OAuth token as a bearer credential', async () => {
		const { fetchStub, calls } = stubFetch(json({}))
		await createFigmaClient({ token: 'oauth', authMode: 'oauth', fetch: fetchStub }).request({
			method: 'GET',
			path: '/v1/discovery',
		})

		expect(headerOf(calls[0], 'authorization')).toBe('Bearer oauth')
		expect(headerOf(calls[0], 'x-figma-token')).toBeNull()
	})
})

describe('createClient credential resolution', () => {
	it('throws with setup instructions when no token is configured', () => {
		expect(() => createClient()).toThrowError(/FIGMA_ACCESS_TOKEN/)
		expect(() => createClient()).toThrowError(/Settings → Security/)
		expect(() => createClient()).toThrowError(/--token/)
	})

	it('reads FIGMA_ACCESS_TOKEN from the environment', async () => {
		process.env.FIGMA_ACCESS_TOKEN = 'env-token'
		const { fetchStub, calls } = stubFetch(json({}))
		await createClient({ fetch: fetchStub }).request({ method: 'GET', path: '/v1/me' })

		expect(headerOf(calls[0], 'x-figma-token')).toBe('env-token')
	})

	it('prefers the --token override over the environment', async () => {
		process.env.FIGMA_ACCESS_TOKEN = 'env-token'
		setTokenOverride('flag-token')
		const { fetchStub, calls } = stubFetch(json({}))
		await createClient({ fetch: fetchStub }).request({ method: 'GET', path: '/v1/me' })

		expect(headerOf(calls[0], 'x-figma-token')).toBe('flag-token')
		expect(getTokenOverride()).toBe('flag-token')
	})

	it('ignores an unexpanded placeholder and reports the credential as missing', () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is the input under test
		process.env.FIGMA_ACCESS_TOKEN = '${FIGMA_ACCESS_TOKEN}'
		expect(() => createClient()).toThrowError(/FIGMA_ACCESS_TOKEN/)
	})

	it('reads the auth mode from FIGMA_AUTH_MODE', async () => {
		process.env.FIGMA_ACCESS_TOKEN = 'env-token'
		process.env.FIGMA_AUTH_MODE = 'oauth'
		const { fetchStub, calls } = stubFetch(json({}))
		await createClient({ fetch: fetchStub }).request({ method: 'GET', path: '/v1/me' })

		expect(headerOf(calls[0], 'authorization')).toBe('Bearer env-token')
	})

	it('rejects an auth mode that is not one of the three Figma supports', () => {
		process.env.FIGMA_ACCESS_TOKEN = 'env-token'
		process.env.FIGMA_AUTH_MODE = 'basic'
		expect(() => createClient()).toThrowError(/personal.*plan.*oauth/)
	})
})

describe('createFigmaClient query serialization', () => {
	async function queryFor(query: Record<string, unknown>) {
		const { fetchStub, calls } = stubFetch(json({}))
		await createFigmaClient({ token: 't', fetch: fetchStub }).request({
			method: 'GET',
			path: '/v1/files/abc',
			query: query as never,
		})
		return new URL(calls[0].url).searchParams
	}

	it('joins an array parameter with commas', async () => {
		expect((await queryFor({ ids: ['1:2', '3:4'] })).get('ids')).toBe('1:2,3:4')
	})

	it('serializes booleans as true and false', async () => {
		const params = await queryFor({ branch_data: true, contents_only: false })
		expect(params.get('branch_data')).toBe('true')
		expect(params.get('contents_only')).toBe('false')
	})

	it('omits undefined and null parameters entirely', async () => {
		const params = await queryFor({ version: undefined, depth: null })
		expect(params.has('version')).toBe(false)
		expect(params.has('depth')).toBe(false)
	})

	// The OpenAPI spec types 15 integer parameters as `number`; a client that
	// hands Figma "30.0" gets 400 "'page_size' must be a valid number".
	it('coerces a numeric parameter to an integer', async () => {
		expect((await queryFor({ page_size: 30.0 })).get('page_size')).toBe('30')
		expect((await queryFor({ depth: 2.7 })).get('depth')).toBe('2')
	})

	it('keeps the fraction on a parameter marked as genuinely fractional', async () => {
		expect((await queryFor({ scale: floatParam(1.5) })).get('scale')).toBe('1.5')
	})
})

describe('createFigmaClient envelope unwrapping', () => {
	it('returns the meta payload when the endpoint wraps its result', async () => {
		const { fetchStub } = stubFetch(json({ status: 200, error: false, meta: { components: [] } }))
		const result = await createFigmaClient({ token: 't', fetch: fetchStub }).request({
			method: 'GET',
			path: '/v1/files/abc/components',
			unwrap: 'meta',
		})

		expect(result).toEqual({ components: [] })
	})

	it('leaves an unwrapped endpoint alone', async () => {
		const { fetchStub } = stubFetch(json({ comments: [] }))
		const result = await createFigmaClient({ token: 't', fetch: fetchStub }).request({
			method: 'GET',
			path: '/v1/files/abc/comments',
		})

		expect(result).toEqual({ comments: [] })
	})

	it('throws when the envelope reports an error despite a 200', async () => {
		const { fetchStub } = stubFetch(json({ status: 400, error: true, message: 'bad node id' }))
		await expect(
			createFigmaClient({ token: 't', fetch: fetchStub }).request({
				method: 'GET',
				path: '/v1/files/abc/components',
				unwrap: 'meta',
			}),
		).rejects.toThrowError(/bad node id/)
	})
})

describe('createFigmaClient error mapping', () => {
	it('throws a FigmaApiError carrying the status, method, and path', async () => {
		const { fetchStub } = stubFetch(json({ status: 404, err: 'Not found' }, { status: 404 }))
		const error = await createFigmaClient({ token: 't', fetch: fetchStub })
			.request({ method: 'GET', path: '/v1/files/abc' })
			.catch((e: unknown) => e)

		expect(error).toBeInstanceOf(FigmaApiError)
		expect((error as FigmaApiError).status).toBe(404)
		expect((error as FigmaApiError).path).toBe('/v1/files/abc')
	})

	// The spec types `err` as always-null; on a 400 it is the diagnostic naming
	// the invalid parameter, which is the most useful thing Figma returns.
	it('surfaces the err diagnostic from the body', async () => {
		const { fetchStub } = stubFetch(json({ status: 400, err: "'scale' must be between 0.01 and 4" }, { status: 400 }))
		await expect(
			createFigmaClient({ token: 't', fetch: fetchStub }).request({ method: 'GET', path: '/v1/images/abc' }),
		).rejects.toThrowError(/'scale' must be between 0.01 and 4/)
	})

	it('surfaces a message field when the body uses one instead', async () => {
		const { fetchStub } = stubFetch(json({ status: 403, message: 'Invalid token' }, { status: 403 }))
		await expect(
			createFigmaClient({ token: 't', fetch: fetchStub }).request({ method: 'GET', path: '/v1/me' }),
		).rejects.toThrowError(/Invalid token/)
	})

	it('carries the rate-limit headers through to the error', async () => {
		const { fetchStub } = stubFetch(
			new Response('{}', {
				status: 429,
				headers: { 'retry-after': '390000', 'x-figma-rate-limit-type': 'low', 'x-figma-plan-tier': 'pro' },
			}),
		)
		const error = (await createFigmaClient({ token: 't', fetch: fetchStub, maxRetries: 0 })
			.request({ method: 'GET', path: '/v1/files/abc' })
			.catch((e: unknown) => e)) as FigmaApiError

		expect(error.retryAfterSeconds).toBe(390000)
		expect(error.rateLimitType).toBe('low')
	})
})

describe('createFigmaClient rate-limit retry', () => {
	function rateLimited(retryAfter: string) {
		return new Response('{}', { status: 429, headers: { 'retry-after': retryAfter } })
	}

	it('waits out a short Retry-After and retries', async () => {
		const { fetchStub, calls } = stubFetch([rateLimited('2'), json({ name: 'Design' })])
		const slept: number[] = []
		const client = createFigmaClient({
			token: 't',
			fetch: fetchStub,
			sleep: async (ms) => {
				slept.push(ms)
			},
		})

		await expect(client.request({ method: 'GET', path: '/v1/files/abc' })).resolves.toEqual({ name: 'Design' })
		expect(calls).toHaveLength(2)
		expect(slept).toEqual([2000])
	})

	// A Retry-After of days is a plan/seat problem, not a transient one. Sleeping
	// on it would hang the caller for the rest of the week.
	it('does not wait out a Retry-After beyond the cap', async () => {
		const { fetchStub, calls } = stubFetch([rateLimited('390000'), json({})])
		const slept: number[] = []
		const client = createFigmaClient({
			token: 't',
			fetch: fetchStub,
			sleep: async (ms) => {
				slept.push(ms)
			},
		})

		await expect(client.request({ method: 'GET', path: '/v1/files/abc' })).rejects.toThrowError(FigmaApiError)
		expect(calls).toHaveLength(1)
		expect(slept).toEqual([])
	})

	it('gives up after maxRetries and throws the last 429', async () => {
		const { fetchStub, calls } = stubFetch([rateLimited('1'), rateLimited('1'), rateLimited('1')])
		const client = createFigmaClient({ token: 't', fetch: fetchStub, maxRetries: 1, sleep: async () => {} })

		await expect(client.request({ method: 'GET', path: '/v1/files/abc' })).rejects.toThrowError(FigmaApiError)
		expect(calls).toHaveLength(2)
	})

	it('does not retry a 500, which Figma returns for requests that are too large', async () => {
		const { fetchStub, calls } = stubFetch([new Response('{}', { status: 500 }), json({})])
		const client = createFigmaClient({ token: 't', fetch: fetchStub, sleep: async () => {} })

		await expect(client.request({ method: 'GET', path: '/v1/images/abc' })).rejects.toThrowError(FigmaApiError)
		expect(calls).toHaveLength(1)
	})
})

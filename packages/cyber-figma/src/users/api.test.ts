import { describe, expect, it } from 'vitest'
import type { FigmaAuthMode, FigmaClient, FigmaRequest } from '../client.js'
import { createUserApi } from './api.js'
import { createFigmaUserGateway } from './gateway.js'

const ME = { id: '1', handle: 'ada', img_url: 'https://img', email: 'ada@example.com' }

function client(authMode: FigmaAuthMode): FigmaClient & { requests: FigmaRequest[] } {
	const requests: FigmaRequest[] = []
	return {
		requests,
		authMode,
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			requests.push(request)
			return ME as T
		},
	}
}

const api = (authMode: FigmaAuthMode = 'personal') => {
	const fake = client(authMode)
	return { fake, api: createUserApi(createFigmaUserGateway(fake)) }
}

describe('me', () => {
	it('returns the account the credential belongs to', async () => {
		const { api: users } = api()

		expect(await users.me()).toMatchObject({ handle: 'ada', email: 'ada@example.com' })
	})

	it('works the same under OAuth, which is tied to a user', async () => {
		const { fake, api: users } = api('oauth')

		await users.me()

		expect(fake.requests).toHaveLength(1)
	})

	// A plan access token is not tied to a user, so Figma refuses this endpoint
	// outright. Spending the request to be told so wastes a call and returns a
	// 403 that reads like an expired token.
	it('refuses a plan access token before spending a request on a certain refusal', async () => {
		const { fake, api: users } = api('plan')

		await expect(users.me()).rejects.toThrowError(/plan access token/i)
		expect(fake.requests).toHaveLength(0)
	})

	it('says what to do instead of a plan access token', async () => {
		const { api: users } = api('plan')

		await expect(users.me()).rejects.toMatchObject({
			hint: expect.stringContaining('--auth-mode'),
		})
	})
})

import { describe, expect, it } from 'vitest'
import type { FigmaAuthMode, FigmaClient, FigmaRequest } from '../client.js'
import { createUserApi } from './api.js'
import { defineUserAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaUserGateway } from './gateway.js'

const ME = { id: '1', handle: 'ada', img_url: 'https://img', email: 'ada@example.com' }

function fakeFigma(authMode: FigmaAuthMode = 'personal'): FigmaClient {
	return {
		authMode,
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			if (request.path !== '/v1/me') throw new Error(`fakeFigma: no fixture for ${request.method} ${request.path}`)
			return ME as T
		},
	}
}

const api = (authMode?: FigmaAuthMode) => createUserApi(createFigmaUserGateway(fakeFigma(authMode)))

describe('user domain', defineUserAcceptanceSpecs({ api: () => api() }))

// Not part of the shared contract, because the live suite runs with a working
// credential: this is the mode the endpoint is unreachable in.
describe('under a plan access token', () => {
	it('names the credential mode as the reason rather than relaying a 403', async () => {
		await expect(api('plan').me()).rejects.toThrowError(/plan access token/i)
	})
})

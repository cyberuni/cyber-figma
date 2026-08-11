import { describe, expect, it } from 'vitest'
import type { FigmaAuthMode, FigmaClient, FigmaRequest } from '../client.js'
import { FigmaApiError } from '../figma-error.js'
import { createOEmbedApi } from './api.js'
import { createFigmaOEmbedGateway } from './gateway.js'

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

function api(authMode: FigmaAuthMode = 'personal', response: unknown = EMBED) {
	const requests: FigmaRequest[] = []
	const client: FigmaClient = {
		authMode,
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			requests.push(request)
			if (response instanceof Error) throw response
			return response as T
		},
	}
	return { requests, api: createOEmbedApi(createFigmaOEmbedGateway(client)) }
}

describe('get', () => {
	it('describes a Figma file URL as an embeddable resource', async () => {
		const { api: oembed } = api()

		expect(await oembed.get('https://www.figma.com/design/abc123/Home')).toMatchObject({ title: 'Home' })
	})

	// The endpoint takes a URL, and a file key is what every other command takes
	// — so the mix-up is the likely one, and it is worth naming.
	it('says how to turn a bare file key into the URL this endpoint needs', async () => {
		const { requests, api: oembed } = api()

		await expect(oembed.get('abc123')).rejects.toThrowError(/URL/i)
		expect(requests).toHaveLength(0)
	})

	it('refuses a plan access token before spending a request on a certain refusal', async () => {
		const { requests, api: oembed } = api('plan')

		await expect(oembed.get('https://www.figma.com/design/abc123/Home')).rejects.toThrowError(/plan access token/i)
		expect(requests).toHaveLength(0)
	})

	// oEmbed is the only endpoint in Figma's spec that answers 501, so a bare
	// "server error" hint would send the caller looking for the wrong thing.
	it('explains a 501, which no other Figma endpoint returns', async () => {
		const notImplemented = new FigmaApiError({ status: 501, method: 'GET', path: '/v1/oembed' })
		const { api: oembed } = api('personal', notImplemented)

		await expect(oembed.get('https://www.figma.com/design/abc123/Home')).rejects.toMatchObject({
			hint: expect.stringContaining('oEmbed'),
		})
	})
})

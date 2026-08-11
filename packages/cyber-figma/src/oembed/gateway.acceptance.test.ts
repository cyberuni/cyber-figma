import { describe } from 'vitest'
import type { FigmaClient, FigmaRequest } from '../client.js'
import { createOEmbedApi } from './api.js'
import { defineOEmbedAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaOEmbedGateway } from './gateway.js'

const URL_UNDER_TEST = 'https://www.figma.com/design/abc123/Home'

// A stand-in Figma that, like the real one, adjusts the embed box to the
// requested maximum while keeping 16:9.
function fakeFigma(): FigmaClient {
	return {
		authMode: 'personal',
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			if (request.path !== '/v1/oembed') throw new Error(`fakeFigma: no fixture for ${request.method} ${request.path}`)
			const width = Number(request.query?.maxwidth ?? 800)
			return {
				version: '1.0',
				type: 'rich',
				title: 'Home',
				key: 'abc123',
				url: URL_UNDER_TEST,
				provider_name: 'Figma',
				provider_url: 'https://www.figma.com',
				cache_age: 3600,
				width,
				height: Math.round((width * 9) / 16),
				html: `<iframe src="https://www.figma.com/embed?url=${URL_UNDER_TEST}"></iframe>`,
			} as T
		},
	}
}

describe(
	'oembed domain',
	defineOEmbedAcceptanceSpecs({
		api: () => createOEmbedApi(createFigmaOEmbedGateway(fakeFigma())),
		url: URL_UNDER_TEST,
	}),
)

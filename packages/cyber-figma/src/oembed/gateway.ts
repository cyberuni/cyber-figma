import type { FigmaAuthMode, FigmaClient } from '../client.js'
import type { GetOEmbedResponse } from '../figma-types.js'

// The oEmbed endpoint (added 2026-03-25) turns any Figma file or published Make
// URL into embed metadata — title, thumbnail, and an iframe — without spending
// a tier 1 file read. Like /v1/me it is gated on the credential mode rather
// than a plan, so the gateway reports the mode it runs under.

export type OEmbedRequest = {
	url: string
	maxWidth?: number
	maxHeight?: number
}

export type OEmbedGateway = {
	get: (request: OEmbedRequest) => Promise<GetOEmbedResponse>
	readonly authMode: FigmaAuthMode
}

export function createFigmaOEmbedGateway(client: FigmaClient): OEmbedGateway {
	return {
		authMode: client.authMode,
		get: (request) =>
			client.request({
				method: 'GET',
				path: '/v1/oembed',
				query: { url: request.url, maxwidth: request.maxWidth, maxheight: request.maxHeight },
			}),
	}
}

import type { FigmaAuthMode, FigmaClient } from '../client.js'
import type { GetMeResponse } from '../figma-types.js'

// `GET /v1/me` is the whole Users tag: one endpoint, tier 3, and the only place
// the account's email is returned. It is gated on the credential *mode* rather
// than on a plan — a plan access token is not tied to a user and can never
// reach it — so the gateway reports the mode it is running under and lets the
// operation above say so before spending a request on a certain 403.

export type UserGateway = {
	me: () => Promise<GetMeResponse>
	readonly authMode: FigmaAuthMode
}

export function createFigmaUserGateway(client: FigmaClient): UserGateway {
	return {
		authMode: client.authMode,
		me: () => client.request({ method: 'GET', path: '/v1/me' }),
	}
}

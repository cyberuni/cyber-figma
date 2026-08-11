import type { FigmaAuthMode } from '../client.js'
import type { GetMeResponse } from '../figma-types.js'
import type { UserGateway } from './gateway.js'

/**
 * The endpoints a plan access token can never reach, refused here rather than
 * at Figma. A plan token is minted for an organization and is not tied to a
 * user, so Figma answers with the same 403 it uses for an expired token — the
 * least informative reading of a failure that was certain before it was sent.
 */
function planTokenRefusal(what: string): Error & { hint: string } {
	const error = new Error(
		`${what} cannot be read with a plan access token: a plan token is minted for an organization and is not tied to a user.`,
	) as Error & { hint: string }
	error.hint =
		'Use a personal access token (Figma Settings → Security) with --auth-mode personal, or an OAuth credential with --auth-mode oauth. To verify a plan access token instead, read something file-scoped, e.g. `cyber-figma file meta <file>`.'
	return error
}

function refusesPlanTokens(authMode: FigmaAuthMode): boolean {
	return authMode === 'plan'
}

export type UserApi = {
	me: () => Promise<GetMeResponse>
}

export function createUserApi(gateway: UserGateway): UserApi {
	return {
		me: async () => {
			if (refusesPlanTokens(gateway.authMode)) throw planTokenRefusal('The current user (/v1/me)')
			return gateway.me()
		},
	}
}

import { isFigmaApiError } from '../figma-error.js'
import type { GetOEmbedResponse } from '../figma-types.js'
import type { OEmbedGateway } from './gateway.js'

const IS_URL = /^[a-z][a-z0-9+.-]*:\/\//i

function withHint<E>(error: E, hint: string): E & { hint: string } {
	return Object.assign(error as object, { hint }) as E & { hint: string }
}

export type OEmbedApi = {
	get: (url: string, opts?: { maxWidth?: number; maxHeight?: number }) => Promise<GetOEmbedResponse>
}

export function createOEmbedApi(gateway: OEmbedGateway): OEmbedApi {
	return {
		get: async (url, opts) => {
			if (!IS_URL.test(url.trim())) {
				throw withHint(
					new Error(`oEmbed takes a URL, not a file key: ${url}`),
					`Every other command takes a file key; this one takes the link. For a file key, use https://www.figma.com/design/${url.trim()}. A published Make site URL works here too.`,
				)
			}
			// A plan access token is minted for an organization rather than a user,
			// and Figma refuses oEmbed for one with the same 403 it uses for an
			// expired token — a refusal that was certain before the request was sent.
			if (gateway.authMode === 'plan') {
				throw withHint(
					new Error('oEmbed cannot be read with a plan access token.'),
					'Use a personal access token (Figma Settings → Security) with --auth-mode personal, or an OAuth credential with --auth-mode oauth. The scope is file_metadata:read.',
				)
			}

			try {
				return await gateway.get({ url, maxWidth: opts?.maxWidth, maxHeight: opts?.maxHeight })
			} catch (error) {
				// 501 is unique to this endpoint in Figma's spec, so the spine's
				// generic 5xx hint — retry with fewer nodes — would mislead.
				if (isFigmaApiError(error) && error.status === 501) {
					throw withHint(
						error,
						'Figma answered 501 Not Implemented, which only the oEmbed endpoint does: it does not produce an embed for this URL. Check that the link is a Figma file or a published Make site, and that it is shared beyond "only invited people".',
					)
				}
				throw error
			}
		},
	}
}

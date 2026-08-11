import { expect, it } from 'vitest'
import type { OEmbedApi } from './api.js'

// The contract the oEmbed domain owes. It is written against whatever URL the
// caller supplies, because the fixture URL and the live one differ — the shape
// of the answer does not.

export type OEmbedAcceptanceDeps = {
	/** Built lazily: a live context needs a credential, which collection time must not require. */
	api: () => OEmbedApi
	/** A Figma file URL or published Make URL the credential can see. */
	url: string
}

export function defineOEmbedAcceptanceSpecs(deps: OEmbedAcceptanceDeps) {
	return () => {
		it('describes the URL as an oEmbed 1.0 rich resource', async () => {
			const embed = await deps.api().get(deps.url)

			expect(embed.version).toBe('1.0')
			expect(embed.type).toBe('rich')
			expect(typeof embed.title).toBe('string')
			expect(embed.html).toContain('<iframe')
		})

		it('names Figma or Make as the provider', async () => {
			expect(['Figma', 'Make']).toContain((await deps.api().get(deps.url)).provider_name)
		})

		it('honors the requested embed dimensions', async () => {
			const embed = await deps.api().get(deps.url, { maxWidth: 400, maxHeight: 225 })

			expect(embed.width).toBeLessThanOrEqual(400)
			expect(embed.height).toBeLessThanOrEqual(225)
		})

		it('refuses a file key, which is what every other command takes', async () => {
			await expect(deps.api().get('abc123')).rejects.toThrowError(/URL/i)
		})
	}
}

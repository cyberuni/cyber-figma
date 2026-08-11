import { expect, it } from 'vitest'
import type { UserApi } from './api.js'

// The contract the users domain owes: one endpoint, whose value is that it
// answers "whose credential is this, and does it work at all".

export type UserAcceptanceDeps = {
	/** Built lazily: a live context needs a credential, which collection time must not require. */
	api: () => UserApi
}

export function defineUserAcceptanceSpecs(deps: UserAcceptanceDeps) {
	return () => {
		it('identifies the account behind the credential', async () => {
			const me = await deps.api().me()

			expect(typeof me.id).toBe('string')
			expect(me.id.length).toBeGreaterThan(0)
			expect(typeof me.handle).toBe('string')
		})

		it('returns the email, which no other endpoint does', async () => {
			expect(await deps.api().me()).toHaveProperty('email')
		})
	}
}

import { expect, it } from 'vitest'
import type { PaymentApi } from './api.js'

// The contract Payments owes, as a factory the unit suite runs against a double
// and the system suite runs against the live API.

export type PaymentAcceptanceDeps = {
	api: PaymentApi
	/** A Figma user id to ask about. */
	userId: string
	/** The id of a plugin, widget, or Community file **you own**. */
	pluginId: string
}

export function definePaymentAcceptanceSpecs(deps: PaymentAcceptanceDeps) {
	return () => {
		it('reports the payment state of a user on a resource', async () => {
			const payment = await deps.api.get({ userId: deps.userId, pluginId: deps.pluginId })

			expect(payment).toHaveProperty('user_id')
			expect(payment).toHaveProperty('resource_id')
		})

		it('refuses a resource id with no user to ask about', async () => {
			await expect(deps.api.get({ pluginId: deps.pluginId })).rejects.toThrowError(/user_id|plugin_payment_token/)
		})

		it('refuses a user id with no resource to ask about', async () => {
			await expect(deps.api.get({ userId: deps.userId })).rejects.toThrowError(/plugin_id/)
		})

		it('refuses two resource ids, because Figma takes exactly one', async () => {
			await expect(
				deps.api.get({ userId: deps.userId, pluginId: deps.pluginId, widgetId: deps.pluginId }),
			).rejects.toThrowError(/exactly one/)
		})
	}
}

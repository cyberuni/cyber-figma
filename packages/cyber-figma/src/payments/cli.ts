import { Command } from 'commander'
import { output, printFields, printNextSteps, printSummary } from '../output.js'
import type { PaymentApi } from './api.js'

type GetCliOptions = {
	pluginPaymentToken?: string
	userId?: string
	communityFileId?: string
	pluginId?: string
	widgetId?: string
}

export function paymentCommand(getApi: () => PaymentApi): Command {
	const cmd = new Command('payment').description(
		'Purchase validation for a plugin, widget, or Community file you own. Personal access token only — the Payments API has no OAuth 2 support at all, and no plan access token support either.',
	)

	cmd
		.command('get')
		.description('Check one user’s payment state on a resource you own')
		.option(
			'--plugin-payment-token <token>',
			'Short-lived token from getPluginPaymentTokenAsync, used inside a plugin or widget',
		)
		.option('--user-id <id>', 'Figma user id to ask about (obtained by having the user OAuth to the REST API)')
		.option('--community-file-id <id>', 'Community file id — the number after "file/" on its Community page')
		.option('--plugin-id <id>', 'Plugin id')
		.option('--widget-id <id>', 'Widget id')
		.action(async (opts: GetCliOptions) => {
			const payment = await getApi().get(opts)

			output(payment, () => {
				const status = (payment.payment_status ?? {}) as { type?: string }
				printFields({
					user_id: payment.user_id,
					resource_id: payment.resource_id,
					resource_type: payment.resource_type,
					status: status.type,
					date_of_purchase: payment.date_of_purchase,
				})
				if (status.type === 'TRIAL') {
					printSummary('\nTRIAL means the user is inside the trial period of a subscription, not that they have paid.')
				}
				printNextSteps(['cyber-figma payment get --user-id <id> --plugin-id <id> --json'])
			})
		})

	return cmd
}

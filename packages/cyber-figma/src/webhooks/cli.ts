import { Command } from 'commander'
import {
	addPaginationOptions,
	type PaginationCliOptions,
	paginationOptionsFromCli,
	printNextPageHint,
} from '../cli-options.js'
import type { WebhookV2, WebhookV2Request } from '../figma-types.js'
import { deleteMessage } from '../idempotent-delete.js'
import { output, printCountSummary, printFields, printNextSteps, printSummary, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import {
	summarizeWebhookRequests,
	WEBHOOK_CONTEXTS,
	WEBHOOK_EVENT_TYPES,
	WEBHOOK_STATUSES,
	type WebhookApi,
} from './api.js'
import { WEBHOOK_LIST_PAGINATION } from './gateway.js'

// Webhooks are the one domain where a wrong command has consequences outside
// Figma: it puts traffic on somebody's URL. So the create path is explicit
// about the immediate PING, and the passcode has a route in that never puts it
// in shell history — and never comes back out in any output format.

const EVENT_HELP = `Event to subscribe to: ${WEBHOOK_EVENT_TYPES.join(', ')}`
const CONTEXT_HELP = `What the webhook watches: ${WEBHOOK_CONTEXTS.join(', ')}`
const STATUS_HELP = `Webhook status: ${WEBHOOK_STATUSES.join(', ')}. PAUSED creates it without firing the initial PING`
const PASSCODE_HELP = 'Passcode Figma echoes back in every payload — verify it at your endpoint. Prefer --passcode-env'
const PASSCODE_ENV_HELP =
	'Name of an environment variable holding the passcode, so it never reaches shell history or the process list'
const ENDPOINT_HELP = 'HTTPS URL Figma will POST events to (max 2048 characters)'

type PasscodeOptions = { passcode?: string; passcodeEnv?: string }

function resolvePasscode(opts: PasscodeOptions): string {
	if (opts.passcodeEnv) {
		const value = process.env[opts.passcodeEnv]
		if (!value) {
			throw new Error(
				`--passcode-env ${opts.passcodeEnv} was given, but ${opts.passcodeEnv} is not set in this environment.`,
			)
		}
		return value
	}
	if (opts.passcode) return opts.passcode
	throw new Error(
		'A passcode is required. Pass --passcode-env <VAR> to read it from the environment (preferred: --passcode <value> is visible in shell history and in the process list).',
	)
}

function webhookFields(webhook: WebhookV2): Record<string, string | null | undefined> {
	return {
		id: webhook.id,
		event_type: webhook.event_type,
		context: `${webhook.context} ${webhook.context_id}`,
		status: webhook.status,
		endpoint: webhook.endpoint,
		description: webhook.description ?? undefined,
		plan_api_id: webhook.plan_api_id,
		client_id: webhook.client_id ?? undefined,
		// passcode is deliberately absent: the api layer masks it, and printing a
		// mask only invites someone to look for the real one.
	}
}

const WEBHOOK_COLUMNS = [
	{ label: 'id', get: (webhook: WebhookV2) => webhook.id },
	{ label: 'event', get: (webhook: WebhookV2) => webhook.event_type },
	{ label: 'status', get: (webhook: WebhookV2) => webhook.status },
	{ label: 'context', get: (webhook: WebhookV2) => `${webhook.context}:${webhook.context_id}` },
	{ label: 'endpoint', get: (webhook: WebhookV2) => truncate(webhook.endpoint, { limit: 60, full: isFull() }) },
]

function responseStatus(request: WebhookV2Request): string {
	const status = (request.response_info as { status?: unknown } | null)?.status
	return status === undefined || status === null ? '-' : String(status)
}

export function webhookCommand(getApi: () => WebhookApi): Command {
	const cmd = new Command('webhook').description('Figma webhooks (v2) — subscribe to file, project, and team events')

	addPaginationOptions(
		cmd
			.command('list')
			.description('List webhooks on a context, or across a whole plan')
			.option('--context <context>', CONTEXT_HELP)
			.option('--context-id <id>', 'Id or Figma URL of the team, project, or file (defaults to FIGMA_TEAM_ID)')
			.option('--plan <plan_api_id>', 'Every webhook on a plan: team-<teamId>, or organization-<orgId>')
			.action(async (opts: PaginationCliOptions & { context?: string; contextId?: string; plan?: string }) => {
				const result = await getApi().list({
					context: opts.context,
					contextId: opts.contextId,
					plan: opts.plan,
					...paginationOptionsFromCli(opts),
				})
				output(result, () => {
					printTable(result.data, WEBHOOK_COLUMNS, { entity: 'webhooks' })
					printCountSummary(result.count, 'webhook(s)')
					printNextPageHint(result, 'cyber-figma webhook list')
					if (result.count > 0) {
						printNextSteps([`cyber-figma webhook requests ${result.data[0]?.id} # recent deliveries and failures`])
					}
				})
			}),
		WEBHOOK_LIST_PAGINATION,
	)

	cmd
		.command('get')
		.description('Show one webhook')
		.argument('<webhook-id>', 'Webhook id')
		.action(async (webhookId: string) => {
			const webhook = await getApi().get(webhookId)
			output(webhook, () => {
				printFields(webhookFields(webhook))
				printNextSteps([`cyber-figma webhook requests ${webhook.id}`])
			})
		})

	cmd
		.command('create')
		.description('Create a webhook')
		.requiredOption('--event <type>', EVENT_HELP)
		.requiredOption('--context <context>', CONTEXT_HELP)
		.option('--context-id <id>', 'Id or Figma URL of the team, project, or file (defaults to FIGMA_TEAM_ID)')
		.requiredOption('--endpoint <url>', ENDPOINT_HELP)
		.option('--passcode <passcode>', PASSCODE_HELP)
		.option('--passcode-env <variable>', PASSCODE_ENV_HELP)
		.option('--status <status>', STATUS_HELP)
		.option('--description <text>', 'Note to yourself about what this webhook is for')
		.addHelpText(
			'after',
			[
				'',
				'Creating an ACTIVE webhook makes Figma POST a PING to the endpoint immediately.',
				'Create it --status PAUSED first if the endpoint is not live yet.',
				'',
				'Who may create one: team context needs a team admin; project and file contexts',
				'need Can edit on that project or file. Caps: 20 per team, 5 per project, 3 per file.',
			].join('\n'),
		)
		.action(
			async (
				opts: PasscodeOptions & {
					event: string
					context: string
					contextId?: string
					endpoint: string
					status?: string
					description?: string
				},
			) => {
				const webhook = await getApi().create({
					event: opts.event,
					context: opts.context,
					contextId: opts.contextId,
					endpoint: opts.endpoint,
					passcode: resolvePasscode(opts),
					status: opts.status,
					description: opts.description,
				})
				output(webhook, () => {
					printFields(webhookFields(webhook))
					printSummary(
						webhook.status === 'PAUSED'
							? '\nCreated PAUSED — no events are delivered, and no PING was sent.'
							: '\nCreated ACTIVE — Figma has sent a PING to the endpoint already.',
					)
					printNextSteps([
						`cyber-figma webhook requests ${webhook.id} # confirm the endpoint answered 200`,
						`cyber-figma webhook delete ${webhook.id}`,
					])
				})
			},
		)

	cmd
		.command('update')
		.description('Update a webhook — its event, endpoint, passcode, status, or description')
		.argument('<webhook-id>', 'Webhook id')
		.requiredOption('--event <type>', EVENT_HELP)
		.requiredOption('--endpoint <url>', ENDPOINT_HELP)
		.option('--passcode <passcode>', PASSCODE_HELP)
		.option('--passcode-env <variable>', PASSCODE_ENV_HELP)
		.option('--status <status>', STATUS_HELP)
		.option('--description <text>', 'Note to yourself about what this webhook is for')
		.addHelpText(
			'after',
			[
				'',
				'Figma replaces the whole webhook: --event, --endpoint and a passcode are all required',
				'even when only one of them changes. A webhook cannot be re-targeted at another team,',
				'project, or file — delete it and create a new one instead.',
			].join('\n'),
		)
		.action(
			async (
				webhookId: string,
				opts: PasscodeOptions & { event: string; endpoint: string; status?: string; description?: string },
			) => {
				const webhook = await getApi().update(webhookId, {
					event: opts.event,
					endpoint: opts.endpoint,
					passcode: resolvePasscode(opts),
					status: opts.status,
					description: opts.description,
				})
				output(webhook, () => {
					printFields(webhookFields(webhook))
					printSummary(`\nUpdated webhook ${webhook.id}`)
				})
			},
		)

	cmd
		.command('delete')
		.description('Delete a webhook — Figma cannot reverse this')
		.argument('<webhook-id>', 'Webhook id')
		.action(async (webhookId: string) => {
			const result = await getApi().remove(webhookId)
			output(result, () => {
				console.log(deleteMessage(result, 'Webhook'))
			})
		})

	cmd
		.command('requests')
		.description('Recent deliveries to a webhook endpoint — the last week, and the only health signal Figma keeps')
		.argument('<webhook-id>', 'Webhook id')
		.option('--failed-only', 'Show only the deliveries that errored')
		.action(async (webhookId: string, opts: { failedOnly?: boolean }) => {
			const all = await getApi().requests(webhookId)
			const requests = opts.failedOnly ? all.filter((request) => request.error_msg !== null) : all
			const summary = summarizeWebhookRequests(all)
			output({ ...summary, requests }, () => {
				printTable(
					requests,
					[
						{ label: 'sent_at', get: (request) => request.request_info.sent_at },
						{ label: 'response', get: responseStatus },
						{
							label: 'error',
							get: (request) => truncate(request.error_msg ?? '', { limit: 80, full: isFull() }) || '-',
						},
					],
					{ entity: 'webhook requests' },
				)
				printSummary(
					`\n${summary.total} delivery attempt(s) in the last week: ${summary.delivered} delivered, ${summary.failed} failed`,
				)
				if (summary.failed > 0) {
					printNextSteps([
						'Figma retries a failed delivery 3 times — after 5 minutes, 30 minutes, and 3 hours — and never disables the webhook itself.',
						`cyber-figma webhook update ${webhookId} --status PAUSED --event <type> --endpoint <url> --passcode-env <VAR>`,
					])
				}
			})
		})

	cmd
		.command('list-team')
		.description('[Deprecated] List a team’s webhooks through the superseded /v2/teams/:id/webhooks endpoint')
		.argument('[team]', 'Team id or team URL (defaults to FIGMA_TEAM_ID)')
		.addHelpText(
			'after',
			'\nFigma deprecated this endpoint. Use `cyber-figma webhook list --context team` instead; this exists only for a plan whose tooling still calls the old path.',
		)
		.action(async (team: string | undefined) => {
			const webhooks = await getApi().listByTeam(team)
			output(webhooks, () => {
				printTable(webhooks, WEBHOOK_COLUMNS, { entity: 'webhooks' })
				printCountSummary(webhooks.length, 'webhook(s)')
				printNextSteps(['cyber-figma webhook list --context team # the endpoint that replaced this one'])
			})
		})

	return cmd
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import { WEBHOOK_CONTEXTS, WEBHOOK_EVENT_TYPES, WEBHOOK_STATUSES, type WebhookApi } from './api.js'
import { WEBHOOK_LIST_PAGINATION } from './gateway.js'

// The tool listing is the whole spec an agent gets, so what a webhook costs —
// a PING at a real URL on creation, an irreversible delete, a passcode that is
// never readable back — is said here rather than left to be discovered.

const asText = (result: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(result) }] })

const eventType = z.enum(WEBHOOK_EVENT_TYPES as [string, ...string[]]).describe('Event to subscribe to')
const context = z.enum(WEBHOOK_CONTEXTS as [string, ...string[]]).describe('What the webhook watches')
const status = z
	.enum(WEBHOOK_STATUSES as [string, ...string[]])
	.optional()
	.describe('PAUSED creates or leaves the webhook without delivering anything, and sends no PING')
const endpoint = z.string().describe('HTTPS URL Figma POSTs events to (max 2048 characters). Plain HTTP is refused')
const passcode = z
	.string()
	.describe(
		'Secret (max 100 characters) Figma includes in every payload so the endpoint can verify the caller. Never readable back: it is masked in every response',
	)
const description = z.string().optional().describe('Note about what this webhook is for')
const webhookId = z.string().describe('Webhook id')

export function registerWebhookTools(server: McpServer, getApi: () => WebhookApi) {
	server.tool(
		'figma_webhook_list',
		'List Figma webhooks on a team, project, or file — or every webhook on a plan. Passcodes come back masked.',
		{
			context: z
				.enum(WEBHOOK_CONTEXTS as [string, ...string[]])
				.optional()
				.describe('Defaults to the configured team'),
			context_id: z.string().optional().describe('Id or Figma URL of the team, project, or file'),
			plan_api_id: z
				.string()
				.optional()
				.describe('Every webhook on a plan: team-<teamId>, or organization-<orgId>. Not with context_id'),
			...paginationParams(WEBHOOK_LIST_PAGINATION),
		},
		async ({ context: ctx, context_id, plan_api_id, ...page }) =>
			asText(
				await getApi().list({
					context: ctx,
					contextId: context_id,
					plan: plan_api_id,
					...paginationOptions(page),
				}),
			),
	)

	server.tool('figma_webhook_get', 'Get one Figma webhook by id', { webhook_id: webhookId }, async ({ webhook_id }) =>
		asText(await getApi().get(webhook_id)),
	)

	server.tool(
		'figma_webhook_create',
		'Create a Figma webhook. An ACTIVE webhook makes Figma POST a PING to the endpoint immediately — create it PAUSED when the endpoint is not live yet. Requires a team admin for a team context, or Can edit on the project or file.',
		{
			event_type: eventType,
			context,
			context_id: z.string().optional().describe('Id or Figma URL of the team, project, or file'),
			endpoint,
			passcode,
			status,
			description,
		},
		async (params) =>
			asText(
				await getApi().create({
					event: params.event_type,
					context: params.context,
					contextId: params.context_id,
					endpoint: params.endpoint,
					passcode: params.passcode,
					status: params.status,
					description: params.description,
				}),
			),
	)

	server.tool(
		'figma_webhook_update',
		'Replace a Figma webhook. event_type, endpoint and passcode are all required even to change one of them, and a webhook cannot be re-targeted at another team, project, or file.',
		{ webhook_id: webhookId, event_type: eventType, endpoint, passcode, status, description },
		async (params) =>
			asText(
				await getApi().update(params.webhook_id, {
					event: params.event_type,
					endpoint: params.endpoint,
					passcode: params.passcode,
					status: params.status,
					description: params.description,
				}),
			),
	)

	server.tool(
		'figma_webhook_delete',
		'Delete a Figma webhook. Figma cannot reverse this. Deleting one that is already gone succeeds and reports already_absent.',
		{ webhook_id: webhookId },
		async ({ webhook_id }) => asText(await getApi().remove(webhook_id)),
	)

	server.tool(
		'figma_webhook_requests',
		'Deliveries to a webhook endpoint over the last week — the only health signal Figma keeps. error_msg is null when the delivery succeeded.',
		{ webhook_id: webhookId },
		async ({ webhook_id }) => asText(await getApi().requests(webhook_id)),
	)
}

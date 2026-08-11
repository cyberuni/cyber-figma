import { isFigmaApiError } from '../figma-error.js'
import type { WebhookV2, WebhookV2Event, WebhookV2Request, WebhookV2Status } from '../figma-types.js'
import { type DeleteResult, deleteIdempotently } from '../idempotent-delete.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import { requireTeamId } from '../scope.js'
import { fileKeyFromInput, parseFigmaUrl } from '../url.js'
import type { WebhookContext, WebhookGateway } from './gateway.js'

// The operations the CLI and the MCP server share. This layer is where the
// three things that make webhooks dangerous live: a passcode never leaves here
// in plaintext, an endpoint is checked before Figma is asked to call it, and a
// refused write says which role the context actually requires instead of
// relaying a bare 403.

export const WEBHOOK_EVENT_TYPES: WebhookV2Event[] = [
	'PING',
	'FILE_UPDATE',
	'FILE_VERSION_UPDATE',
	'FILE_DELETE',
	'LIBRARY_PUBLISH',
	'FILE_COMMENT',
	'DEV_MODE_STATUS_UPDATE',
]

export const WEBHOOK_STATUSES: WebhookV2Status[] = ['ACTIVE', 'PAUSED']

export const WEBHOOK_CONTEXTS: WebhookContext[] = ['team', 'project', 'file']

/** Figma's documented ceilings for the two free-text fields of a webhook. */
const ENDPOINT_MAX_LENGTH = 2048
const PASSCODE_MAX_LENGTH = 100

/**
 * What a passcode looks like once it has left this module. Figma already blanks
 * it on `GET`, but `POST` and `PUT` echo the real one back, and the whole point
 * of a passcode is that your endpoint can tell Figma from anyone else — so it
 * is masked on every path out, including `--json` and MCP tool output, rather
 * than only in the human-readable table.
 */
export const REDACTED_PASSCODE = '***'

export type WebhookCreateInput = {
	event: string
	context: string
	contextId?: string
	endpoint: string
	passcode: string
	status?: string
	description?: string
}

export type WebhookUpdateInput = {
	event: string
	endpoint: string
	passcode: string
	status?: string
	description?: string
}

export type WebhookListInput = PaginationOptions & {
	context?: string
	contextId?: string
	/** A constructed plan api id: `team-<teamId>` or `organization-<orgId>`. */
	plan?: string
}

export type WebhookRequestSummary = { total: number; delivered: number; failed: number }

export type WebhookApi = {
	list: (input?: WebhookListInput) => Promise<PaginatedResult<WebhookV2>>
	/** The deprecated `GET /v2/teams/{team_id}/webhooks`, kept only as a compatibility shim. */
	listByTeam: (team?: string) => Promise<WebhookV2[]>
	get: (webhookId: string) => Promise<WebhookV2>
	create: (input: WebhookCreateInput) => Promise<WebhookV2>
	update: (webhookId: string, input: WebhookUpdateInput) => Promise<WebhookV2>
	remove: (webhookId: string) => Promise<DeleteResult>
	requests: (webhookId: string) => Promise<WebhookV2Request[]>
}

function redact(webhook: WebhookV2): WebhookV2 {
	return { ...webhook, passcode: webhook.passcode ? REDACTED_PASSCODE : '' }
}

function parseEventType(value: string): WebhookV2Event {
	const event = value.trim().toUpperCase() as WebhookV2Event
	if (!WEBHOOK_EVENT_TYPES.includes(event)) {
		throw new Error(`Unknown webhook event type "${value}". Figma supports: ${WEBHOOK_EVENT_TYPES.join(', ')}.`)
	}
	return event
}

function parseStatus(value: string | undefined): WebhookV2Status | undefined {
	if (value === undefined) return undefined
	const status = value.trim().toUpperCase() as WebhookV2Status
	if (!WEBHOOK_STATUSES.includes(status)) {
		throw new Error(`Unknown webhook status "${value}". Figma supports: ${WEBHOOK_STATUSES.join(', ')}.`)
	}
	return status
}

function parseContext(value: string): WebhookContext {
	const context = value.trim().toLowerCase() as WebhookContext
	if (!WEBHOOK_CONTEXTS.includes(context)) {
		throw new Error(`Unknown webhook context "${value}". Figma supports: ${WEBHOOK_CONTEXTS.join(', ')}.`)
	}
	return context
}

/**
 * Figma answers a plain-HTTP request with a 403 and calls it a permission
 * problem, so an `http://` endpoint would be delivered to for as long as it
 * takes someone to read the error. It is refused here instead.
 */
function validateEndpoint(endpoint: string): string {
	const value = endpoint.trim()
	if (!value) throw new Error('A webhook endpoint URL is required.')
	if (value.length > ENDPOINT_MAX_LENGTH) {
		throw new Error(`The webhook endpoint is ${value.length} characters; Figma accepts at most ${ENDPOINT_MAX_LENGTH}.`)
	}
	let url: URL
	try {
		url = new URL(value)
	} catch {
		throw new Error(`"${value}" is not a URL. A webhook endpoint must be an absolute https:// URL.`)
	}
	if (url.protocol !== 'https:') {
		throw new Error(
			`A webhook endpoint must use https. Figma refuses plain-HTTP requests with a 403, and the passcode would travel in the clear. Received: ${url.protocol}//`,
		)
	}
	return value
}

function validatePasscode(passcode: string): string {
	if (!passcode) {
		throw new Error(
			'A webhook passcode is required. Figma sends it back in every payload, and comparing it is the only way your endpoint can tell a real Figma delivery from anyone else who found the URL.',
		)
	}
	if (passcode.length > PASSCODE_MAX_LENGTH) {
		throw new Error(`The webhook passcode is longer than the ${PASSCODE_MAX_LENGTH} characters Figma accepts.`)
	}
	return passcode
}

const PLAN_API_ID = /^(team|organization)-.+$/

function validatePlanApiId(plan: string): string {
	const value = plan.trim()
	if (!PLAN_API_ID.test(value)) {
		throw new Error(
			`"${plan}" is not a plan api id. Construct it as team-<teamId> on Professional, or organization-<orgId> on Organization, Enterprise, and Government. The team id follows /team/ in a Figma URL and the org id follows /files/.`,
		)
	}
	return value
}

function isUrl(value: string): boolean {
	return /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
}

function projectIdFromInput(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) throw new Error('A Figma project id or project URL is required')
	if (!isUrl(trimmed)) return trimmed
	const parsed = parseFigmaUrl(trimmed)
	if (!parsed.project_id) {
		throw new Error(`No project id in URL: ${trimmed} — expected a figma.com /files/project/<id>/… link`)
	}
	return parsed.project_id
}

/**
 * The id of the thing being watched, in the form its context spells it: a team
 * id (which may come from `--team`/`FIGMA_TEAM_ID`), a project id, or a file
 * key. A URL is accepted for all three, because the URL bar is where a user
 * gets any of them.
 */
function resolveContextId(context: WebhookContext, contextId: string | undefined): string {
	if (context === 'team') return requireTeamId(contextId)
	if (!contextId) {
		throw new Error(`A ${context} webhook needs the ${context} it watches: pass the ${context} id or its Figma URL.`)
	}
	return context === 'file' ? fileKeyFromInput(contextId) : projectIdFromInput(contextId)
}

const CREATOR_ROLE: Record<WebhookContext, string> = {
	team: 'a team admin of that team',
	project: '"Can edit" on that project',
	file: '"Can edit" on that file',
}

const CONTEXT_CAP: Record<WebhookContext, string> = {
	team: '20 webhooks per team',
	project: '5 per project',
	file: '3 per file',
}

/**
 * A 403 on a webhook write is one of four things, and the status code says
 * none of them. Naming the role this particular context requires is the part
 * the spine cannot derive, since it does not know what was being written to.
 */
function permissionHint(context: WebhookContext): string {
	return [
		`Creating or changing a ${context} webhook requires ${CREATOR_ROLE[context]}, and a token with the webhooks:write scope.`,
		`Figma also caps webhooks at ${CONTEXT_CAP[context]} and refuses one over the cap the same way.`,
		'A personal access token that has expired also reports as 403 rather than 401 — that is the cheapest of the four to rule out.',
	].join(' ')
}

async function withPermissionHint<T>(context: WebhookContext, operation: () => Promise<T>): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		if (isFigmaApiError(error) && (error.status === 403 || error.status === 401)) {
			throw Object.assign(error, { hint: permissionHint(context) })
		}
		throw error
	}
}

/** Delivered versus failed, over the week of history Figma keeps. */
export function summarizeWebhookRequests(requests: WebhookV2Request[]): WebhookRequestSummary {
	const failed = requests.filter((request) => request.error_msg !== null).length
	return { total: requests.length, delivered: requests.length - failed, failed }
}

export function createWebhookApi(gateway: WebhookGateway): WebhookApi {
	return {
		list: async ({ context, contextId, plan, ...page }: WebhookListInput = {}) => {
			if (plan !== undefined && (context !== undefined || contextId !== undefined)) {
				throw new Error(
					'A plan api id and a context are mutually exclusive: query one context, or every context on the plan.',
				)
			}
			// With neither, the configured team is the context a user means — and
			// when no team is configured, requireTeamId says how to set one.
			const query =
				plan !== undefined
					? { planApiId: validatePlanApiId(plan) }
					: (() => {
							const resolved = parseContext(context ?? 'team')
							return { context: resolved, contextId: resolveContextId(resolved, contextId) }
						})()

			const result = await gateway.list(query, page)
			return { ...result, data: result.data.map(redact) }
		},
		listByTeam: async (team) => (await gateway.listByTeam(requireTeamId(team))).webhooks.map(redact),
		get: async (webhookId) => redact(await gateway.get(webhookId)),
		create: async (input) => {
			const context = parseContext(input.context)
			const body = {
				event_type: parseEventType(input.event),
				context,
				context_id: resolveContextId(context, input.contextId),
				endpoint: validateEndpoint(input.endpoint),
				passcode: validatePasscode(input.passcode),
				...(input.status !== undefined && { status: parseStatus(input.status) }),
				...(input.description !== undefined && { description: input.description }),
			}
			return redact(await withPermissionHint(context, () => gateway.create(body)))
		},
		update: async (webhookId, input) => {
			// The PUT body carries no context: Figma does not let a webhook be
			// re-targeted, only re-pointed at another endpoint.
			const body = {
				event_type: parseEventType(input.event),
				endpoint: validateEndpoint(input.endpoint),
				passcode: validatePasscode(input.passcode),
				...(input.status !== undefined && { status: parseStatus(input.status) }),
				...(input.description !== undefined && { description: input.description }),
			}
			return redact(await gateway.update(webhookId, body))
		},
		remove: (webhookId) => deleteIdempotently('webhook', webhookId, () => gateway.remove(webhookId)),
		requests: async (webhookId) => (await gateway.requests(webhookId)).requests,
	}
}

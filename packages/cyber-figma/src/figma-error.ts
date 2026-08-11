// Figma error classification — AXI principle 6, applied to an API whose status
// codes mean less than they look like they mean. A bare 403 or 429 relayed to
// the caller is the difference between a ten-second fix and a support ticket:
// 403 is where an expired token lands, and a multi-day 429 is usually a file
// sitting in the wrong plan context rather than a real quota.

export type FigmaErrorReason =
	| 'bad_request'
	| 'unauthenticated'
	| 'forbidden'
	| 'plan_gated'
	| 'not_found'
	| 'rate_limited'
	| 'server_error'

export type FigmaErrorBody = {
	ok: false
	error: {
		kind: 'figma_api' | 'config' | 'internal'
		message: string
		status?: number
		reason?: FigmaErrorReason
		hint?: string
		retry_after_seconds?: number
		plan_tier?: string
		rate_limit_type?: string
		upgrade_link?: string
	}
}

export type FigmaApiErrorInit = {
	status: number
	method: string
	path: string
	statusText?: string
	/**
	 * The diagnostic the API put in the body — `err` on the images and nodes
	 * endpoints, `message` elsewhere. On a 400 this is the single most useful
	 * thing Figma returns, and the OpenAPI spec types it as always-null, so a
	 * spec-generated client throws it away.
	 */
	detail?: string | null
	headers?: Headers | Record<string, string>
}

function headerValue(headers: FigmaApiErrorInit['headers'], name: string): string | undefined {
	if (!headers) return undefined
	if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined
	const lower = name.toLowerCase()
	for (const [key, value] of Object.entries(headers as Record<string, string>)) {
		if (key.toLowerCase() === lower) return value
	}
	return undefined
}

export class FigmaApiError extends Error {
	readonly status: number
	readonly method: string
	readonly path: string
	readonly detail: string | null
	readonly retryAfterSeconds: number | undefined
	readonly planTier: string | undefined
	readonly rateLimitType: string | undefined
	readonly upgradeLink: string | undefined

	constructor(init: FigmaApiErrorInit) {
		const detail = init.detail ?? null
		super(detail ?? `Figma responded ${init.status}${init.statusText ? ` ${init.statusText}` : ''}`)
		this.name = 'FigmaApiError'
		this.status = init.status
		this.method = init.method
		this.path = init.path
		this.detail = detail

		const retryAfter = Number(headerValue(init.headers, 'retry-after'))
		this.retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
		this.planTier = headerValue(init.headers, 'x-figma-plan-tier')
		this.rateLimitType = headerValue(init.headers, 'x-figma-rate-limit-type')
		this.upgradeLink = headerValue(init.headers, 'x-figma-upgrade-link')
	}
}

export function isFigmaApiError(error: unknown): error is FigmaApiError {
	return error instanceof FigmaApiError
}

/** `390000` → `4d 12h`. A bare second count on a multi-day wait reads as a bug. */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h ${minutes % 60}m`
	return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

const SEAT_CLASS: Record<string, string> = {
	low: 'View/Collab seat quota',
	high: 'Full/Dev seat quota',
}

const A_DAY_IN_SECONDS = 86_400

/**
 * The documented field trap: a paid-plan user with a Full seat gets
 * `X-Figma-Rate-Limit-Type: low` and a multi-day Retry-After, because the limit
 * follows the plan the *resource* lives in, not the best plan the user belongs
 * to. It reads as an API bug and is almost always a file parked in a personal
 * (Starter) context. Only say so when the symptoms actually match.
 */
function looksLikeStarterContextTrap(error: FigmaApiError): boolean {
	if (error.rateLimitType !== 'low') return false
	if (error.planTier === 'starter' || error.planTier === 'student') return false
	return (error.retryAfterSeconds ?? 0) >= A_DAY_IN_SECONDS
}

function rateLimitHint(error: FigmaApiError): string {
	const parts = ['Figma rate-limited this request (429).']
	if (error.retryAfterSeconds !== undefined) {
		parts.push(`Retry after ${error.retryAfterSeconds}s (${formatDuration(error.retryAfterSeconds)}).`)
	} else {
		parts.push('Figma sent no Retry-After; back off exponentially before retrying.')
	}
	if (error.planTier) parts.push(`Plan tier of the resource: ${error.planTier}.`)
	if (error.rateLimitType) {
		parts.push(`Rate-limit type: ${error.rateLimitType} (${SEAT_CLASS[error.rateLimitType] ?? 'unknown seat class'}).`)
	}
	if (looksLikeStarterContextTrap(error)) {
		parts.push(
			`A "low" rate-limit type with a multi-day wait on a ${error.planTier ?? 'paid'} plan usually means the file itself lives in a personal or Starter context: limits follow the plan the file lives in, not the best plan you belong to. Move the file into the paid team to get "high" limits.`,
		)
	}
	if (error.upgradeLink) parts.push(`Seat and plan settings: ${error.upgradeLink}`)
	parts.push('Batch node ids into one call and cache results — Figma names batching as the primary mitigation.')
	return parts.join(' ')
}

type PlanGate = {
	matches: (path: string) => boolean
	requirement: string
}

// Six endpoint groups are gated above ordinary file permissions. Figma answers
// them with the same 401/403 it uses for a mistyped file key, so the path is the
// only signal that the call was never going to work on this plan.
const PLAN_GATES: PlanGate[] = [
	{
		matches: (path) => /^\/v1\/files\/[^/]+\/variables(\/|$)/.test(path),
		requirement:
			'Variables requires an Enterprise plan — reading as well as writing. Writing additionally needs a Full seat or admin, and is not reachable with a plan access token (file_variables:write is unsupported there).',
	},
	{
		matches: (path) => path.startsWith('/v1/analytics/libraries/'),
		requirement: 'Library Analytics requires an Enterprise plan and the library_analytics:read scope.',
	},
	{
		matches: (path) => path.startsWith('/v1/activity_logs'),
		requirement:
			'Activity Logs requires an Enterprise plan and an org admin, authenticated with org OAuth (scope org:activity_log_read) or a plan access token. A personal access token cannot reach it.',
	},
	{
		matches: (path) => path.startsWith('/v1/developer_logs'),
		requirement:
			'Developer Logs requires an Enterprise plan with the Governance+ add-on and an org admin, and is reachable only with a plan access token (scope org:developer_log_read).',
	},
	{
		matches: (path) => path.startsWith('/v1/ai_usage'),
		requirement:
			'AI Usage requires an Enterprise plan and an org admin, and is reachable only with a plan access token (scope org:ai_metering_usage_read).',
	},
	{
		matches: (path) => path.startsWith('/v1/discovery'),
		requirement:
			'Discovery requires an Enterprise plan with the Governance+ add-on and an org admin, authenticated with OAuth 2 (scope org:discovery_read). Neither a personal nor a plan access token can reach it.',
	},
]

/** The plan/seat/auth-mode requirement of a gated endpoint, if this path is one. */
export function planGateFor(path: string): string | undefined {
	return PLAN_GATES.find((gate) => gate.matches(path))?.requirement
}

function reasonFor(error: FigmaApiError): FigmaErrorReason | undefined {
	const { status } = error
	if ((status === 401 || status === 403) && planGateFor(error.path)) return 'plan_gated'
	if (status === 400) return 'bad_request'
	if (status === 401) return 'unauthenticated'
	if (status === 403) return 'forbidden'
	if (status === 404) return 'not_found'
	if (status === 429) return 'rate_limited'
	if (status >= 500) return 'server_error'
	return undefined
}

const FORBIDDEN_HINT = [
	'Figma answers 403 for three different things.',
	'(1) The token expired or was revoked — personal access tokens last at most 90 days and there is no rotation, so this is the most common cause and it does NOT surface as 401.',
	'(2) The account lacks permission on this file, project, or team.',
	'(3) The request was made over plain HTTP instead of HTTPS.',
	'Check the token at Settings → Security first; it is the cheapest of the three to rule out.',
].join(' ')

function hintFor(error: FigmaApiError, reason: FigmaErrorReason | undefined): string | undefined {
	switch (reason) {
		case 'rate_limited':
			return rateLimitHint(error)
		case 'unauthenticated':
			return 'Figma did not accept the credential. Set FIGMA_ACCESS_TOKEN (or pass --token) to a personal access token from Settings → Security → Generate new token.'
		case 'forbidden':
			return FORBIDDEN_HINT
		case 'plan_gated':
			return planGateFor(error.path)
		case 'bad_request':
			return 'Figma answers 400 both for invalid parameters and for a request whose result was too large to build in time. If the parameters look right, narrow the request — use --depth and --ids on file reads, and fewer nodes per image render.'
		case 'server_error':
			return 'Figma answers 500 most often for very large image render requests. Retry with fewer nodes or a smaller scale.'
		default:
			return undefined
	}
}

/**
 * A hint an operation attached to the error it threw. The operation knows more
 * about the call than the status code does, so it outranks the derived hint.
 */
function attachedHint(error: unknown): string | undefined {
	if (!error || typeof error !== 'object' || !('hint' in error)) return undefined
	const hint = (error as { hint?: unknown }).hint
	return typeof hint === 'string' ? hint : undefined
}

export function buildFigmaErrorBody(error: unknown): FigmaErrorBody {
	if (isFigmaApiError(error)) {
		const reason = reasonFor(error)
		const hint = attachedHint(error) ?? hintFor(error, reason)
		return {
			ok: false,
			error: {
				kind: 'figma_api',
				message: error.message,
				status: error.status,
				...(reason !== undefined && { reason }),
				...(hint !== undefined && { hint }),
				...(error.retryAfterSeconds !== undefined && { retry_after_seconds: error.retryAfterSeconds }),
				...(error.planTier !== undefined && { plan_tier: error.planTier }),
				...(error.rateLimitType !== undefined && { rate_limit_type: error.rateLimitType }),
				...(error.upgradeLink !== undefined && { upgrade_link: error.upgradeLink }),
			},
		}
	}

	const message = error instanceof Error ? error.message : String(error)
	if (message.includes('FIGMA_ACCESS_TOKEN')) {
		return {
			ok: false,
			error: {
				kind: 'config',
				message,
				hint:
					attachedHint(error) ??
					// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is what the reader must recognize
					'Set FIGMA_ACCESS_TOKEN in the environment the CLI or MCP server runs in, or pass --token <pat>. Do not put an unexpanded ${VAR} reference in an mcp.json env block — it arrives as literal text.',
			},
		}
	}

	return {
		ok: false,
		error: {
			kind: 'internal',
			message,
			...(attachedHint(error) !== undefined && { hint: attachedHint(error) }),
		},
	}
}

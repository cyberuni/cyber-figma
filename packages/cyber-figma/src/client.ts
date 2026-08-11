import { envValue } from './env.js'
import { FigmaApiError } from './figma-error.js'

// There is no official Figma JS SDK, and the published OpenAPI spec has verified
// defects a generator would faithfully reproduce as bugs — so this is a small
// hand-written client over fetch. The spec is used for response *types* only
// (see figma-types.ts); nothing here is generated from it.

const DEFAULT_BASE_URL = 'https://api.figma.com'

/**
 * The three credentials Figma accepts. `personal` and `plan` are both sent as
 * `X-Figma-Token` and differ only in what they can reach; `oauth` is a bearer
 * credential. The mode is configured rather than sniffed: Figma documents no
 * reliable way to tell one token string from another, and guessing wrong turns
 * a working credential into a 403.
 */
export type FigmaAuthMode = 'personal' | 'plan' | 'oauth'

const AUTH_MODES: FigmaAuthMode[] = ['personal', 'plan', 'oauth']

/**
 * A query value that must keep its fraction on the wire. Figma's OpenAPI spec
 * types 15 integer parameters as `number`, and a client that sends `page_size`
 * as `30.0` gets back `400 "'page_size' must be a valid number"` — so numbers
 * are truncated to integers at this boundary by default. `scale` on the images
 * endpoint is the one parameter that is legitimately fractional (0.01–4), and
 * it opts out through this marker.
 */
export type FloatParam = { readonly __float: number }

export function floatParam(value: number): FloatParam {
	return { __float: value }
}

function isFloatParam(value: unknown): value is FloatParam {
	return typeof value === 'object' && value !== null && '__float' in value
}

export type QueryValue = string | number | boolean | string[] | FloatParam | null | undefined

export type FigmaRequest = {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	path: string
	query?: Record<string, QueryValue>
	body?: unknown
	/**
	 * Figma wraps some payloads in a `{ status, error, meta }` envelope and
	 * returns others at the top level, inconsistently across the API. Endpoints
	 * that wrap declare it here and get the payload itself back.
	 */
	unwrap?: 'meta'
}

export type FigmaClient = {
	request: <T = unknown>(spec: FigmaRequest) => Promise<T>
	readonly authMode: FigmaAuthMode
}

export type FigmaClientOptions = {
	token?: string
	authMode?: FigmaAuthMode
	baseUrl?: string
	fetch?: typeof fetch
	/** Retries after a 429 whose Retry-After is inside the cap. Default 2. */
	maxRetries?: number
	/**
	 * The longest Retry-After this client will actually wait out, in seconds.
	 * Figma answers some 429s with multi-day waits; those are a seat or plan
	 * problem, and sleeping on one would hang the caller for days. Default 60.
	 */
	maxRetryDelaySeconds?: number
	sleep?: (ms: number) => Promise<void>
}

let tokenOverride: string | undefined
let authModeOverride: FigmaAuthMode | undefined

/** The `--token` flag, which outranks every environment variable. */
export function setTokenOverride(token: string | undefined) {
	tokenOverride = token
}

export function getTokenOverride(): string | undefined {
	return tokenOverride
}

export function setAuthModeOverride(mode: FigmaAuthMode | undefined) {
	authModeOverride = mode
}

const MISSING_TOKEN_MESSAGE = `FIGMA_ACCESS_TOKEN environment variable is not set.

To create a personal access token (PAT):
  1. Go to https://www.figma.com/ and open Settings → Security
  2. Click "Generate new token", pick its scopes and expiry (90 days maximum)
  3. Copy the token — it is only shown once

Then set it in your shell:
  export FIGMA_ACCESS_TOKEN=<your-token>

Or pass it inline with --token:
  cyber-figma --token <your-token> <command>

For CI or org automation an org admin can mint a plan access token instead; run
it with FIGMA_AUTH_MODE=plan. Note plan tokens cannot reach /v1/me, /v1/oembed,
comment writes, or variable writes.`

export function parseAuthMode(value: string | undefined): FigmaAuthMode | undefined {
	if (value === undefined) return undefined
	const mode = value.toLowerCase()
	if (!AUTH_MODES.includes(mode as FigmaAuthMode)) {
		throw new Error(`Unknown auth mode "${value}". FIGMA_AUTH_MODE must be one of: personal, plan, oauth.`)
	}
	return mode as FigmaAuthMode
}

function authHeaders(token: string, mode: FigmaAuthMode): Record<string, string> {
	return mode === 'oauth' ? { authorization: `Bearer ${token}` } : { 'x-figma-token': token }
}

function serializeQueryValue(value: Exclude<QueryValue, null | undefined>): string {
	if (Array.isArray(value)) return value.join(',')
	if (isFloatParam(value)) return String(value.__float)
	if (typeof value === 'number') return String(Math.trunc(value))
	return String(value)
}

function buildUrl(baseUrl: string, path: string, query: FigmaRequest['query']): string {
	const url = new URL(path, baseUrl)
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value === undefined || value === null) continue
		url.searchParams.set(key, serializeQueryValue(value))
	}
	return url.toString()
}

async function readBody(response: Response): Promise<unknown> {
	if (response.status === 204) return undefined
	const text = await response.text()
	if (!text) return undefined
	try {
		return JSON.parse(text)
	} catch {
		return text
	}
}

type ErrorEnvelope = {
	err?: unknown
	message?: unknown
	error?: unknown
	status?: unknown
	meta?: unknown
}

/**
 * The diagnostic Figma put in the body. `err` is the images and nodes
 * endpoints' field — the spec types it as always-null, but on a 400 it names
 * the invalid parameter, which is the best error detail the API gives.
 */
function errorDetail(body: unknown): string | undefined {
	if (typeof body === 'string' && body) return body
	if (!body || typeof body !== 'object') return undefined
	const envelope = body as ErrorEnvelope
	for (const candidate of [envelope.err, envelope.message]) {
		if (typeof candidate === 'string' && candidate) return candidate
	}
	return undefined
}

/** An envelope that reports failure in its body while the HTTP status says 200. */
function envelopeError(body: unknown): { status: number; detail: string | undefined } | undefined {
	if (!body || typeof body !== 'object') return undefined
	const envelope = body as ErrorEnvelope
	if (envelope.error !== true && typeof envelope.err !== 'string') return undefined
	return {
		status: typeof envelope.status === 'number' ? envelope.status : 502,
		detail: errorDetail(body),
	}
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createFigmaClient(options: FigmaClientOptions = {}): FigmaClient {
	if (!options.token) throw new Error(MISSING_TOKEN_MESSAGE)
	const token: string = options.token
	const authMode = options.authMode ?? 'personal'
	const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
	const doFetch = options.fetch ?? globalThis.fetch
	const maxRetries = options.maxRetries ?? 2
	const maxRetryDelaySeconds = options.maxRetryDelaySeconds ?? 60
	const sleep = options.sleep ?? defaultSleep

	async function send(spec: FigmaRequest): Promise<Response> {
		const url = buildUrl(baseUrl, spec.path, spec.query)
		const headers: Record<string, string> = {
			accept: 'application/json',
			...authHeaders(token, authMode),
		}
		if (spec.body !== undefined) headers['content-type'] = 'application/json'

		return doFetch(url, {
			method: spec.method,
			headers,
			...(spec.body !== undefined && { body: JSON.stringify(spec.body) }),
		})
	}

	async function request<T = unknown>(spec: FigmaRequest): Promise<T> {
		let attempt = 0
		for (;;) {
			const response = await send(spec)

			if (response.status === 429 && attempt < maxRetries) {
				const retryAfter = Number(response.headers.get('retry-after'))
				if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= maxRetryDelaySeconds) {
					attempt += 1
					await sleep(retryAfter * 1000)
					continue
				}
			}

			const body = await readBody(response)
			if (!response.ok) {
				throw new FigmaApiError({
					status: response.status,
					statusText: response.statusText,
					method: spec.method,
					path: spec.path,
					detail: errorDetail(body),
					headers: response.headers,
				})
			}

			const failed = envelopeError(body)
			if (failed) {
				throw new FigmaApiError({
					status: failed.status,
					method: spec.method,
					path: spec.path,
					detail: failed.detail,
					headers: response.headers,
				})
			}

			if (spec.unwrap === 'meta' && body && typeof body === 'object' && 'meta' in body) {
				return (body as { meta: T }).meta
			}
			return body as T
		}
	}

	return {
		request,
		get authMode() {
			return authMode
		},
	}
}

/**
 * The client the CLI and the MCP server share: same options, but the credential
 * and auth mode come from `--token`/`FIGMA_ACCESS_TOKEN` and `FIGMA_AUTH_MODE`.
 */
export function createClient(options: Omit<FigmaClientOptions, 'token' | 'authMode'> = {}): FigmaClient {
	return createFigmaClient({
		...options,
		token: tokenOverride ?? envValue('FIGMA_ACCESS_TOKEN'),
		authMode: authModeOverride ?? parseAuthMode(envValue('FIGMA_AUTH_MODE')) ?? 'personal',
		baseUrl: options.baseUrl ?? envValue('FIGMA_API_BASE_URL'),
	})
}

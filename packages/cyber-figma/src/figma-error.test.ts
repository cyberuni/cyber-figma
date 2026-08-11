import { describe, expect, it } from 'vitest'
import { buildFigmaErrorBody, FigmaApiError } from './figma-error.js'

function apiError(status: number, init: Partial<ConstructorParameters<typeof FigmaApiError>[0]> = {}) {
	return new FigmaApiError({ status, method: 'GET', path: '/v1/files/abc', ...init })
}

describe('FigmaApiError', () => {
	it('carries the status, method, and path of the refused request', () => {
		const error = apiError(404)
		expect(error).toBeInstanceOf(Error)
		expect(error.status).toBe(404)
		expect(error.method).toBe('GET')
		expect(error.path).toBe('/v1/files/abc')
	})

	it("uses the API's own diagnostic as the message when there is one", () => {
		expect(apiError(400, { detail: "'page_size' must be a valid number" }).message).toContain(
			"'page_size' must be a valid number",
		)
	})

	it('falls back to a status description when the API sends no diagnostic', () => {
		expect(apiError(404).message).toContain('404')
	})
})

describe('buildFigmaErrorBody for a plain failure', () => {
	it('reports a 404 as a not_found figma_api error', () => {
		const body = buildFigmaErrorBody(apiError(404))
		expect(body.ok).toBe(false)
		expect(body.error.kind).toBe('figma_api')
		expect(body.error.status).toBe(404)
		expect(body.error.reason).toBe('not_found')
	})

	it('reports a 401 as unauthenticated and names the token variable', () => {
		const body = buildFigmaErrorBody(apiError(401))
		expect(body.error.reason).toBe('unauthenticated')
		expect(body.error.hint).toContain('FIGMA_ACCESS_TOKEN')
	})
})

describe('buildFigmaErrorBody for a 429', () => {
	const rateLimited = apiError(429, {
		headers: {
			'retry-after': '390000',
			'x-figma-plan-tier': 'pro',
			'x-figma-rate-limit-type': 'low',
			'x-figma-upgrade-link': 'https://www.figma.com/pricing',
		},
	})

	it('reports the reason as rate_limited', () => {
		expect(buildFigmaErrorBody(rateLimited).error.reason).toBe('rate_limited')
	})

	it('surfaces the retry, plan tier, seat class, and upgrade link as structured fields', () => {
		const body = buildFigmaErrorBody(rateLimited)
		expect(body.error.retry_after_seconds).toBe(390000)
		expect(body.error.plan_tier).toBe('pro')
		expect(body.error.rate_limit_type).toBe('low')
		expect(body.error.upgrade_link).toBe('https://www.figma.com/pricing')
	})

	it('spells the wait out in human units in the hint', () => {
		const hint = buildFigmaErrorBody(rateLimited).error.hint ?? ''
		expect(hint).toContain('4d 12h')
	})

	it('explains that a low rate-limit type is a seat quota, not a plan quota', () => {
		const hint = buildFigmaErrorBody(rateLimited).error.hint ?? ''
		expect(hint).toContain('View/Collab')
	})

	it('handles a 429 that carries no rate-limit headers', () => {
		const body = buildFigmaErrorBody(apiError(429))
		expect(body.error.reason).toBe('rate_limited')
		expect(body.error.retry_after_seconds).toBeUndefined()
		expect(body.error.hint).toBeTruthy()
	})
})

describe('buildFigmaErrorBody names the Starter-context trap', () => {
	it('explains a multi-day low-tier wait on a paid plan as a file in the wrong plan context', () => {
		const hint =
			buildFigmaErrorBody(
				apiError(429, {
					headers: { 'retry-after': '390000', 'x-figma-plan-tier': 'pro', 'x-figma-rate-limit-type': 'low' },
				}),
			).error.hint ?? ''
		expect(hint).toMatch(/Starter|personal/i)
		expect(hint).toContain('the plan the file lives in')
	})

	it('does not blame plan context for an ordinary short high-tier wait', () => {
		const hint =
			buildFigmaErrorBody(
				apiError(429, {
					headers: { 'retry-after': '30', 'x-figma-plan-tier': 'enterprise', 'x-figma-rate-limit-type': 'high' },
				}),
			).error.hint ?? ''
		expect(hint).not.toMatch(/Starter/i)
	})
})

describe('buildFigmaErrorBody for a 403', () => {
	const forbidden = buildFigmaErrorBody(apiError(403))

	it('reports the reason as forbidden', () => {
		expect(forbidden.error.reason).toBe('forbidden')
	})

	// Figma's file-endpoints error table puts token expiry on 403, not 401, and a
	// personal access token expires after 90 days with no rotation. Collapsing
	// this into "permission denied" hides the likeliest cause.
	it('names token expiry as a cause alongside permission', () => {
		expect(forbidden.error.hint).toMatch(/expire/i)
		expect(forbidden.error.hint).toMatch(/permission/i)
	})

	it('names plain HTTP as a cause, which Figma also answers 403 for', () => {
		expect(forbidden.error.hint).toContain('HTTPS')
	})
})

describe('buildFigmaErrorBody for enterprise-gated endpoints', () => {
	it.each([
		['/v1/files/abc/variables/local', /Enterprise/],
		['/v1/files/abc/variables', /Enterprise/],
		['/v1/analytics/libraries/abc/component/actions', /Enterprise/],
		['/v1/activity_logs', /org admin/],
		['/v1/developer_logs', /Governance\+/],
		['/v1/ai_usage/daily', /org admin/],
		['/v1/discovery', /Governance\+/],
	])('reports %s as plan_gated', (path, expected) => {
		const body = buildFigmaErrorBody(apiError(403, { path }))
		expect(body.error.reason).toBe('plan_gated')
		expect(body.error.hint).toMatch(expected)
	})

	it('reports a gated endpoint refused with 401 as plan_gated too', () => {
		expect(buildFigmaErrorBody(apiError(401, { path: '/v1/ai_usage/daily' })).error.reason).toBe('plan_gated')
	})

	it('names the auth modes a gated endpoint accepts when a PAT cannot reach it', () => {
		expect(buildFigmaErrorBody(apiError(403, { path: '/v1/developer_logs' })).error.hint).toContain('plan access token')
	})

	it('leaves an ordinary file endpoint as a plain forbidden', () => {
		expect(buildFigmaErrorBody(apiError(403, { path: '/v1/files/abc' })).error.reason).toBe('forbidden')
	})
})

describe('buildFigmaErrorBody for non-API failures', () => {
	it('classifies a missing-credential error as config, not internal', () => {
		const body = buildFigmaErrorBody(new Error('FIGMA_ACCESS_TOKEN environment variable is not set.'))
		expect(body.error.kind).toBe('config')
		expect(body.error.hint).toContain('FIGMA_ACCESS_TOKEN')
	})

	it('classifies anything else as internal', () => {
		expect(buildFigmaErrorBody(new Error('kaboom')).error.kind).toBe('internal')
	})

	it('reports a non-Error throw as its string form', () => {
		expect(buildFigmaErrorBody('kaboom').error.message).toBe('kaboom')
	})

	// An operation that knows why Figma refused it can attach a hint to the thrown
	// error; it knows more about the call than the status code does, so it wins.
	it('prefers a hint the operation attached over the status-derived one', () => {
		const error = Object.assign(apiError(403), { hint: 'This file key is a branch key; use the main file key.' })
		expect(buildFigmaErrorBody(error).error.hint).toBe('This file key is a branch key; use the main file key.')
	})
})

import { describe, expect, it } from 'vitest'
import { exitCodeFor } from '../cli-error.js'
import type { FigmaClient, FigmaRequest } from '../client.js'
import { buildFigmaErrorBody, FigmaApiError } from '../figma-error.js'
import { createVariableApi } from './api.js'
import { createFigmaVariableGateway } from './gateway.js'

// Variables is Enterprise-gated on read as well as write, and Figma answers a
// gated call with the same 401/403 it uses for a mistyped file key. The spine
// classifies that from the request path — so this suite is the domain's proof
// that the classification actually fires for the paths this domain uses, rather
// than the domain writing status-code handling of its own.

function refusingClient(status: number): FigmaClient {
	return {
		authMode: 'personal',
		async request<T>(spec: FigmaRequest): Promise<T> {
			throw new FigmaApiError({ status, method: spec.method, path: spec.path, detail: 'Not allowed' })
		},
	}
}

async function refusalFrom(status: number, call: (api: ReturnType<typeof createVariableApi>) => Promise<unknown>) {
	const api = createVariableApi(createFigmaVariableGateway(refusingClient(status)))
	try {
		await call(api)
	} catch (error) {
		return { body: buildFigmaErrorBody(error), exitCode: exitCodeFor(error) }
	}
	throw new Error('expected the call to be refused')
}

const OPERATIONS: [string, (api: ReturnType<typeof createVariableApi>) => Promise<unknown>][] = [
	['local variables', (api) => api.list('abc123')],
	['local collections', (api) => api.collections('abc123')],
	['published variables', (api) => api.list('abc123', { published: true })],
	['a variable by id', (api) => api.get('abc123', 'VariableID:1:2')],
	['a change set', (api) => api.apply('abc123', { variableCollections: [{ action: 'CREATE', name: 'Brand' }] })],
]

describe.each(OPERATIONS)('reading %s', (_name, call) => {
	it.each([401, 403])('reports a %i as above the plan level, not as a permission mistake', async (status) => {
		const { body, exitCode } = await refusalFrom(status, call)

		expect(body.error.reason).toBe('plan_gated')
		expect(exitCode).toBe(7)
	})

	it('names the Enterprise requirement in the hint', async () => {
		const { body } = await refusalFrom(403, call)

		expect(body.error.hint).toMatch(/Enterprise/)
	})
})

describe('the write path specifically', () => {
	it('names the seat and the plan-token limits, which reading does not have', async () => {
		const { body } = await refusalFrom(403, (api) =>
			api.apply('abc123', { variableCollections: [{ action: 'CREATE', name: 'Brand' }] }),
		)

		expect(body.error.hint).toMatch(/Full seat or admin/)
		expect(body.error.hint).toMatch(/plan access token/)
	})
})

describe('errors that are not the plan gate', () => {
	it('leaves a 404 classified as not found, so a mistyped file key stays distinguishable', async () => {
		const { body, exitCode } = await refusalFrom(404, (api) => api.list('abc123'))

		expect(body.error.reason).toBe('not_found')
		expect(exitCode).toBe(5)
	})

	it('leaves a 429 classified as rate limited', async () => {
		const { exitCode } = await refusalFrom(429, (api) => api.list('abc123'))

		expect(exitCode).toBe(6)
	})
})

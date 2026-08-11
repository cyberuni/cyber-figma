import { expect, it } from 'vitest'
import type { WebhookV2 } from '../figma-types.js'
import type { PaginatedResult } from '../pagination.js'
import { REDACTED_PASSCODE, type WebhookApi } from './api.js'

// The contract the webhooks domain owes, written once and run twice: against a
// stateful double in `gateway.acceptance.test.ts`, and against the live API in
// `gateway.system.ts`. Webhooks are almost entirely a write surface, so the
// lifecycle spec is the one that matters — and it is opt-in, because running it
// creates a real webhook on a real team.

export type WebhookAcceptanceDeps = {
	api: WebhookApi
	list: () => Promise<PaginatedResult<WebhookV2>>
	/**
	 * Where a throwaway webhook may be created. Absent means read-only: the
	 * lifecycle spec is skipped rather than failed, so an account without write
	 * access still gets the read contract checked.
	 */
	write?: {
		context: 'team' | 'project' | 'file'
		contextId?: string
		endpoint: string
		passcode: string
	}
}

export function defineWebhookAcceptanceSpecs(deps: WebhookAcceptanceDeps) {
	const write = deps.write

	return () => {
		it('lists webhooks in the uniform result shape', async () => {
			const result = await deps.list()

			expect(Array.isArray(result.data)).toBe(true)
			expect(result.count).toBe(result.data.length)
			expect(result.pagination_model).toBe('url_cursor')
		})

		it('reports every listed webhook with the fields a caller has to branch on', async () => {
			for (const webhook of (await deps.list()).data) {
				expect(webhook).toMatchObject({
					id: expect.any(String),
					event_type: expect.any(String),
					context: expect.any(String),
					context_id: expect.any(String),
					status: expect.any(String),
					endpoint: expect.any(String),
				})
			}
		})

		it('never lists a passcode in plaintext', async () => {
			for (const webhook of (await deps.list()).data) {
				expect([REDACTED_PASSCODE, '']).toContain(webhook.passcode)
			}
		})

		it.skipIf(!write)('creates, reads back, updates, and deletes a webhook', async () => {
			if (!write) return
			// PAUSED, because an ACTIVE webhook fires a PING at the endpoint the
			// moment it is created — a test must not put traffic on someone's URL.
			const created = await deps.api.create({
				event: 'PING',
				context: write.context,
				contextId: write.contextId,
				endpoint: write.endpoint,
				passcode: write.passcode,
				status: 'PAUSED',
				description: 'cyber-figma acceptance',
			})

			try {
				expect(created.id).toBeTruthy()
				expect(created.status).toBe('PAUSED')
				expect(created.passcode).not.toBe(write.passcode)

				const fetched = await deps.api.get(created.id)
				expect(fetched.id).toBe(created.id)
				expect(fetched.endpoint).toBe(write.endpoint)
				expect(fetched.passcode).not.toBe(write.passcode)

				const updated = await deps.api.update(created.id, {
					event: 'PING',
					endpoint: write.endpoint,
					passcode: write.passcode,
					status: 'PAUSED',
					description: 'cyber-figma acceptance (updated)',
				})
				expect(updated.description).toBe('cyber-figma acceptance (updated)')

				// A paused webhook has no deliveries, but the endpoint still answers.
				expect(Array.isArray(await deps.api.requests(created.id))).toBe(true)
			} finally {
				expect(await deps.api.remove(created.id)).toMatchObject({ already_absent: false })
			}

			// Deleting what is already gone is the state the caller asked for.
			expect(await deps.api.remove(created.id)).toMatchObject({ deleted: true, already_absent: true })
		})
	}
}

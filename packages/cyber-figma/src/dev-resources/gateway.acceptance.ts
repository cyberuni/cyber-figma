import { expect, it } from 'vitest'
import type { DevResourceApi } from './api.js'
import { DevResourceWriteFailed } from './write-result.js'

// The contract the dev resources domain owes, whatever is underneath it: the
// in-memory double in gateway.acceptance.test.ts, and the live API in
// gateway.system.ts. Both are held to the same bar — above all to the one that
// makes this domain unusual, that a 200 can still mean "nothing was written".

export type DevResourceAcceptanceDeps = {
	/** Built on first use, so a skipped live suite never needs a credential. */
	api: () => DevResourceApi
	/** A **main** file key — these endpoints reject a branch key. */
	fileKey: string
	/**
	 * A node in that file. Writes attach to it, so the write specs only run when
	 * one is supplied; a read-only credential still exercises the read contract.
	 */
	nodeId?: string
}

const LINK_NAME = 'cyber-figma acceptance link'

export function defineDevResourceAcceptanceSpecs(deps: DevResourceAcceptanceDeps) {
	const { api, fileKey, nodeId } = deps

	return () => {
		it('names the file and node every dev resource is attached to', async () => {
			const { data } = await api().list(fileKey)

			for (const resource of data) {
				expect(resource).toMatchObject({
					id: expect.any(String),
					url: expect.any(String),
					file_key: expect.any(String),
					node_id: expect.any(String),
				})
			}
		})

		if (!nodeId) return

		it('attaches a link to a node, renames it, and removes it again', async () => {
			const url = `https://example.com/cyber-figma/${Date.now()}`
			const created = await api().create([{ file: fileKey, nodeId, name: LINK_NAME, url }])

			expect(created).toMatchObject({ ok: true, action: 'create', requested: 1, succeeded: 1, failed: 0 })
			const id = created.dev_resources[0].id

			try {
				const listed = await api().list(fileKey, { nodeIds: nodeId })
				expect(listed.data.map((resource) => resource.id)).toContain(id)

				const updated = await api().update([{ id, name: `${LINK_NAME} (renamed)` }])
				expect(updated).toMatchObject({ ok: true, action: 'update', succeeded: 1, failed: 0 })
			} finally {
				expect(await api().remove(fileKey, id)).toMatchObject({ deleted: true })
			}

			const after = await api().list(fileKey, { nodeIds: nodeId })
			expect(after.data.map((resource) => resource.id)).not.toContain(id)
		})

		// The trap, end to end: Figma answers the second attach with 200 and an
		// `errors` array. Nothing was written, so this must not read as success.
		it('fails loudly when a 200 carries an error for every requested link', async () => {
			const url = `https://example.com/cyber-figma/duplicate/${Date.now()}`
			const first = await api().create([{ file: fileKey, nodeId, name: LINK_NAME, url }])
			const id = first.dev_resources[0].id

			try {
				await expect(api().create([{ file: fileKey, nodeId, name: LINK_NAME, url }])).rejects.toBeInstanceOf(
					DevResourceWriteFailed,
				)
			} finally {
				await api().remove(fileKey, id)
			}
		})

		it('reports the surviving links when only some of a bulk create fail', async () => {
			const url = `https://example.com/cyber-figma/partial/${Date.now()}`
			const first = await api().create([{ file: fileKey, nodeId, name: LINK_NAME, url }])
			const id = first.dev_resources[0].id

			try {
				const second = await api().create([
					{ file: fileKey, nodeId, name: LINK_NAME, url },
					{ file: fileKey, nodeId, name: LINK_NAME, url: `${url}/other` },
				])

				expect(second).toMatchObject({ ok: false, requested: 2, succeeded: 1, failed: 1 })
				expect(second.errors[0].error).toEqual(expect.any(String))
				await api().remove(fileKey, second.dev_resources[0].id)
			} finally {
				await api().remove(fileKey, id)
			}
		})
	}
}

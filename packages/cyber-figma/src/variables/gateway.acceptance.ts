import { expect, it } from 'vitest'
import type { LocalVariable } from '../figma-types.js'
import type { VariableApi } from './api.js'

// The contract the variables domain owes, written so the same specs run against
// the doubles and against a live Enterprise file. Variables is Enterprise-gated
// on read as well as write, so for most contributors the doubles are the only
// place these ever run — which is exactly why the contract lives here rather
// than in assertions scattered through the unit tests.
//
// Nothing here assumes what is in the file. Every expectation is either derived
// from the file's own contents or is about a request that never reaches Figma.

export type VariableAcceptanceDeps = {
	api: () => VariableApi
	/** The file the specs read. Live: an Enterprise file the credential can see. */
	file: () => string
	/**
	 * Run the specs that write. Off by default: `POST variables` mutates a real
	 * file and there is no REST way to unpublish what it does.
	 */
	includeMutations?: boolean
	/** Run the published-view specs. Off when the fixture file publishes nothing. */
	includePublished?: boolean
}

export function defineVariableAcceptanceSpecs(deps: VariableAcceptanceDeps) {
	const file = () => deps.file()

	return () => {
		it('lists the local variables as objects, not the id-keyed map Figma sends', async () => {
			const result = await deps.api().list(file())

			expect(Array.isArray(result.data)).toBe(true)
			for (const variable of result.data) {
				expect(typeof variable.id).toBe('string')
				expect(typeof variable.name).toBe('string')
				expect(typeof variable.variableCollectionId).toBe('string')
			}
		})

		it('lists the local collections from the same response', async () => {
			const result = await deps.api().collections(file())

			for (const collection of result.data) {
				expect(typeof collection.id).toBe('string')
				expect(typeof collection.name).toBe('string')
			}
		})

		it('reports every local variable against a collection the file also lists', async () => {
			const [variables, collections] = await Promise.all([deps.api().list(file()), deps.api().collections(file())])
			const known = new Set(collections.data.map((collection) => collection.id))

			for (const variable of variables.data) {
				expect(known).toContain(variable.variableCollectionId)
			}
		})

		it('returns mode values on the local view, which is the only place they are readable', async () => {
			const [variable] = (await deps.api().list(file())).data

			if (!variable) return
			expect((variable as LocalVariable).valuesByMode).toBeTypeOf('object')
		})

		it('filters to a single collection without asking Figma for it again', async () => {
			const all = await deps.api().list(file())
			const collectionId = all.data[0]?.variableCollectionId

			if (!collectionId) return
			const filtered = await deps.api().list(file(), { collectionId })

			expect(filtered.data.length).toBeGreaterThan(0)
			expect(filtered.data.every((variable) => variable.variableCollectionId === collectionId)).toBe(true)
			expect(filtered.data.length).toBeLessThanOrEqual(all.data.length)
		})

		it('resolves a variable by the id a node carries in boundVariables', async () => {
			const [variable] = (await deps.api().list(file())).data

			if (!variable) return
			expect(await deps.api().get(file(), variable.id)).toMatchObject({ id: variable.id, name: variable.name })
		})

		it('names the id and the file when the variable is not there', async () => {
			await expect(deps.api().get(file(), 'VariableID:0:0')).rejects.toThrow(/VariableID:0:0/)
		})

		if (deps.includePublished !== false) {
			it('carries a subscribed_id on every published variable, which the local view has no reason to', async () => {
				const published = await deps.api().list(file(), { published: true })

				for (const variable of published.data) {
					expect(typeof (variable as { subscribed_id?: string }).subscribed_id).toBe('string')
				}
			})

			it('omits modes from the published view, so mode values are read locally', async () => {
				const published = await deps.api().collections(file(), { published: true })

				for (const collection of published.data) {
					expect(collection).not.toHaveProperty('modes')
				}
			})
		}

		it('rejects an empty change set before spending a request on it', async () => {
			await expect(deps.api().apply(file(), {})).rejects.toThrow(/at least one/)
		})

		it('rejects a change set whose entries are malformed, naming each one', async () => {
			await expect(
				deps.api().apply(file(), { variables: [{ action: 'UPDATE' }, { action: 'CREATE', name: 'a.b' }] }),
			).rejects.toThrow(/variables\[0\][\s\S]*variables\[1\]/)
		})

		it('rejects a mode value whose type contradicts the variable created beside it', async () => {
			await expect(
				deps.api().apply(file(), {
					variables: [{ action: 'CREATE', id: 'tmp', name: 'gap', variableCollectionId: 'c', resolvedType: 'FLOAT' }],
					variableModeValues: [{ variableId: 'tmp', modeId: 'm', value: 'wide' }],
				}),
			).rejects.toThrow(/FLOAT/)
		})

		if (!deps.includeMutations) return

		it('creates a collection, a variable, and a value in one request, mapping the temporary ids', async () => {
			const result = await deps.api().apply(file(), {
				variableCollections: [{ action: 'CREATE', id: 'tmp_collection', name: 'cyber-figma acceptance' }],
				variables: [
					{
						action: 'CREATE',
						id: 'tmp_variable',
						name: 'acceptance/gap',
						variableCollectionId: 'tmp_collection',
						resolvedType: 'FLOAT',
					},
				],
			})

			expect(Object.keys(result.temp_id_to_real_id)).toEqual(expect.arrayContaining(['tmp_collection', 'tmp_variable']))
			expect(result.changes).toEqual({ variableCollections: 1, variables: 1 })

			const created = result.temp_id_to_real_id.tmp_variable as string
			expect((await deps.api().get(file(), created)).name).toBe('acceptance/gap')

			await deps.api().apply(file(), {
				variableCollections: [{ action: 'DELETE', id: result.temp_id_to_real_id.tmp_collection as string }],
			})
		})

		it('says that a written change is invisible to other files until the library is published', async () => {
			const result = await deps.api().apply(file(), {
				variableCollections: [{ action: 'CREATE', id: 'tmp', name: 'cyber-figma publish note' }],
			})

			expect(result.note).toMatch(/publish/i)

			await deps.api().apply(file(), {
				variableCollections: [{ action: 'DELETE', id: result.temp_id_to_real_id.tmp as string }],
			})
		})
	}
}

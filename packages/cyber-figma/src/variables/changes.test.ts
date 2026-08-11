import { describe, expect, it } from 'vitest'
import { parseVariableChanges } from './changes.js'

const CREATE_COLLECTION = { action: 'CREATE', id: 'tmp_collection', name: 'Brand' }

describe('shape', () => {
	it('accepts a change set carrying all four arrays', () => {
		const changes = {
			variableCollections: [CREATE_COLLECTION],
			variableModes: [{ action: 'CREATE', id: 'tmp_mode', name: 'Dark', variableCollectionId: 'tmp_collection' }],
			variables: [
				{
					action: 'CREATE',
					id: 'tmp_var',
					name: 'brand/primary',
					variableCollectionId: 'tmp_collection',
					resolvedType: 'COLOR',
				},
			],
			variableModeValues: [{ variableId: 'tmp_var', modeId: 'tmp_mode', value: { r: 1, g: 0, b: 0, a: 1 } }],
		}

		expect(parseVariableChanges(changes)).toEqual(changes)
	})

	it('rejects a change set that is not an object', () => {
		expect(() => parseVariableChanges('[]')).toThrow(/must be a JSON object/)
	})

	it('rejects a change set with nothing in it, rather than posting a no-op', () => {
		expect(() => parseVariableChanges({})).toThrow(/at least one/)
	})

	it('names an unknown top-level key instead of silently dropping it', () => {
		expect(() => parseVariableChanges({ variableValues: [] })).toThrow(/variableValues/)
	})

	it('rejects a member that is not an array', () => {
		expect(() => parseVariableChanges({ variables: {} })).toThrow(/variables must be an array/)
	})

	it('reports every problem it found, not just the first', () => {
		let message = ''
		try {
			parseVariableChanges({ variables: [{ action: 'UPDATE' }, { action: 'DELETE' }] })
		} catch (error) {
			message = (error as Error).message
		}

		expect(message).toContain('variables[0]')
		expect(message).toContain('variables[1]')
	})

	it('attaches the endpoint documentation as a hint', () => {
		try {
			parseVariableChanges({})
			expect.unreachable('should have thrown')
		} catch (error) {
			expect((error as { hint?: string }).hint).toMatch(/variableCollections/)
		}
	})
})

describe('actions', () => {
	it('rejects an unknown action', () => {
		expect(() => parseVariableChanges({ variables: [{ action: 'UPSERT', id: 'x' }] })).toThrow(/UPSERT/)
	})

	it('requires an id on an update', () => {
		expect(() => parseVariableChanges({ variableCollections: [{ action: 'UPDATE', name: 'Brand' }] })).toThrow(
			/variableCollections\[0\].*id/s,
		)
	})

	it('requires an id on a delete', () => {
		expect(() => parseVariableChanges({ variableCollections: [{ action: 'DELETE' }] })).toThrow(
			/variableCollections\[0\].*id/s,
		)
	})

	it('requires a name when creating a collection', () => {
		expect(() => parseVariableChanges({ variableCollections: [{ action: 'CREATE' }] })).toThrow(
			/variableCollections\[0\].*name/s,
		)
	})
})

describe('modes', () => {
	const mode = (over: Record<string, unknown> = {}) => ({
		action: 'CREATE',
		name: 'Dark',
		variableCollectionId: 'c',
		...over,
	})

	it('requires the collection a created mode belongs to', () => {
		expect(() => parseVariableChanges({ variableModes: [mode({ variableCollectionId: undefined })] })).toThrow(
			/variableCollectionId/,
		)
	})

	it('rejects a mode name longer than the documented 40 characters', () => {
		expect(() => parseVariableChanges({ variableModes: [mode({ name: 'm'.repeat(41) })] })).toThrow(/40 characters/)
	})

	it('rejects more than 40 modes created in one collection', () => {
		const modes = Array.from({ length: 41 }, (_, i) => mode({ name: `mode ${i}` }))

		expect(() => parseVariableChanges({ variableModes: modes })).toThrow(/40 modes/)
	})

	it('counts the 40-mode limit per collection, not across the request', () => {
		const modes = [
			...Array.from({ length: 30 }, (_, i) => mode({ name: `a ${i}`, variableCollectionId: 'a' })),
			...Array.from({ length: 30 }, (_, i) => mode({ name: `b ${i}`, variableCollectionId: 'b' })),
		]

		expect(() => parseVariableChanges({ variableModes: modes })).not.toThrow()
	})
})

describe('variables', () => {
	const variable = (over: Record<string, unknown> = {}) => ({
		action: 'CREATE',
		name: 'primary',
		variableCollectionId: 'c',
		resolvedType: 'COLOR',
		...over,
	})

	it('requires a resolved type when creating', () => {
		expect(() => parseVariableChanges({ variables: [variable({ resolvedType: undefined })] })).toThrow(/resolvedType/)
	})

	it('rejects a resolved type Figma does not define', () => {
		expect(() => parseVariableChanges({ variables: [variable({ resolvedType: 'INT' })] })).toThrow(
			/BOOLEAN, FLOAT, STRING, COLOR/,
		)
	})

	it('rejects the characters Figma forbids in a variable name', () => {
		expect(() => parseVariableChanges({ variables: [variable({ name: 'brand.primary' })] })).toThrow(/\. \{ \}/)
	})

	it('allows a slash, which is how Figma groups variables', () => {
		expect(() => parseVariableChanges({ variables: [variable({ name: 'brand/primary' })] })).not.toThrow()
	})

	it('rejects two created variables sharing a name in one collection', () => {
		expect(() => parseVariableChanges({ variables: [variable(), variable({ resolvedType: 'FLOAT' })] })).toThrow(
			/unique/,
		)
	})

	it('allows the same name in two different collections', () => {
		expect(() =>
			parseVariableChanges({ variables: [variable(), variable({ variableCollectionId: 'other' })] }),
		).not.toThrow()
	})

	it('rejects more than 5000 variables created in one collection', () => {
		const variables = Array.from({ length: 5001 }, (_, i) => variable({ name: `token ${i}` }))

		expect(() => parseVariableChanges({ variables })).toThrow(/5000 variables/)
	})
})

describe('mode values', () => {
	const value = (over: Record<string, unknown> = {}) => ({ variableId: 'v', modeId: 'm', value: 1, ...over })

	it('requires the variable and the mode', () => {
		expect(() => parseVariableChanges({ variableModeValues: [{ value: 1 }] })).toThrow(/variableId/)
	})

	it('requires the value key to be present, because null is meaningful', () => {
		expect(() => parseVariableChanges({ variableModeValues: [{ variableId: 'v', modeId: 'm' }] })).toThrow(/value/)
	})

	it('accepts null, which removes an override so the parent value applies', () => {
		expect(() => parseVariableChanges({ variableModeValues: [value({ value: null })] })).not.toThrow()
	})

	it('accepts a variable alias', () => {
		expect(() =>
			parseVariableChanges({
				variableModeValues: [value({ value: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' } })],
			}),
		).not.toThrow()
	})

	it('rejects a value shape that is none of the documented ones', () => {
		expect(() => parseVariableChanges({ variableModeValues: [value({ value: { hex: '#fff' } })] })).toThrow(/value/)
	})

	it('rejects a value whose type contradicts the variable created in the same request', () => {
		expect(() =>
			parseVariableChanges({
				variables: [{ action: 'CREATE', id: 'tmp', name: 'gap', variableCollectionId: 'c', resolvedType: 'FLOAT' }],
				variableModeValues: [value({ variableId: 'tmp', value: 'wide' })],
			}),
		).toThrow(/FLOAT/)
	})

	it('accepts an alias for a variable of any resolved type', () => {
		expect(() =>
			parseVariableChanges({
				variables: [{ action: 'CREATE', id: 'tmp', name: 'gap', variableCollectionId: 'c', resolvedType: 'FLOAT' }],
				variableModeValues: [value({ variableId: 'tmp', value: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' } })],
			}),
		).not.toThrow()
	})

	it('leaves a value alone when the variable is not part of this request', () => {
		expect(() =>
			parseVariableChanges({ variableModeValues: [value({ variableId: 'VariableID:9:9', value: 'x' })] }),
		).not.toThrow()
	})
})

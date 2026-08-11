import { beforeEach, describe, expect, it } from 'vitest'
import type { FigmaClient, FigmaRequest } from '../client.js'
import { FigmaApiError } from '../figma-error.js'
import type { LocalVariable, LocalVariableCollection, PostVariablesRequestBody } from '../figma-types.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { createVariableApi } from './api.js'
import { defineVariableAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaVariableGateway, VARIABLE_LIST_PAGINATION } from './gateway.js'

// A stand-in for the Variables half of the Figma API: an in-memory file whose
// POST really applies the batch, in the documented order, with the documented
// temporary-id mapping. Variables is Enterprise-gated on read as well as write,
// so most contributors can never run these specs against Figma — this double is
// the safety net, and a shallow one that only echoed requests back would not be
// worth having.

const FILE_KEY = 'acceptance-file'

type FakeFile = {
	collections: Map<string, LocalVariableCollection>
	variables: Map<string, LocalVariable>
}

function seededFile(): FakeFile {
	const collectionId = 'VariableCollectionId:1:1'
	const modeId = '1:0'
	return {
		collections: new Map([
			[
				collectionId,
				{
					id: collectionId,
					name: 'Brand',
					key: 'collection-key',
					modes: [
						{ modeId, name: 'Light' },
						{ modeId: '1:1', name: 'Dark' },
					],
					defaultModeId: modeId,
					remote: false,
					hiddenFromPublishing: false,
					variableIds: ['VariableID:1:2'],
				},
			],
		]),
		variables: new Map([
			[
				'VariableID:1:2',
				{
					id: 'VariableID:1:2',
					name: 'brand/primary',
					key: 'variable-key',
					variableCollectionId: collectionId,
					resolvedType: 'COLOR',
					valuesByMode: { [modeId]: { r: 1, g: 0, b: 0, a: 1 } },
					remote: false,
					description: 'The primary brand color',
					hiddenFromPublishing: false,
					scopes: ['ALL_FILLS'],
					codeSyntax: {},
				},
			],
		]),
	}
}

function badRequest(path: string, detail: string): FigmaApiError {
	return new FigmaApiError({ status: 400, method: 'POST', path, detail })
}

/** The batch endpoint, applied in the documented array order. */
function applyChanges(file: FakeFile, changes: PostVariablesRequestBody, path: string): Record<string, string> {
	const tempIdToRealId: Record<string, string> = {}
	let counter = 100
	const nextId = (prefix: string) => `${prefix}:2:${(counter += 1)}`
	const real = (id: string) => tempIdToRealId[id] ?? id

	for (const change of changes.variableCollections ?? []) {
		if (change.action === 'CREATE') {
			const id = nextId('VariableCollectionId')
			const modeId = nextId('ModeId')
			if (change.id) tempIdToRealId[change.id] = id
			if (change.initialModeId) tempIdToRealId[change.initialModeId] = modeId
			file.collections.set(id, {
				id,
				name: change.name,
				key: `${id}-key`,
				modes: [{ modeId, name: 'Mode 1' }],
				defaultModeId: modeId,
				remote: false,
				hiddenFromPublishing: change.hiddenFromPublishing ?? false,
				variableIds: [],
			})
			continue
		}
		const collection = file.collections.get(real(change.id))
		if (!collection) throw badRequest(path, `No variable collection ${change.id}`)
		if (change.action === 'DELETE') {
			for (const variableId of collection.variableIds) file.variables.delete(variableId)
			file.collections.delete(collection.id)
			continue
		}
		if (change.name !== undefined) collection.name = change.name
	}

	for (const change of changes.variableModes ?? []) {
		if (change.action === 'DELETE') {
			for (const collection of file.collections.values()) {
				collection.modes = collection.modes.filter((mode) => mode.modeId !== real(change.id))
			}
			continue
		}
		const collection = file.collections.get(real(change.variableCollectionId))
		if (!collection) throw badRequest(path, `No variable collection ${change.variableCollectionId}`)
		if (change.action === 'CREATE') {
			const modeId = nextId('ModeId')
			if (change.id) tempIdToRealId[change.id] = modeId
			collection.modes.push({ modeId, name: change.name })
			continue
		}
		const mode = collection.modes.find((candidate) => candidate.modeId === real(change.id))
		if (!mode) throw badRequest(path, `No mode ${change.id}`)
		if (change.name !== undefined) mode.name = change.name
	}

	for (const change of changes.variables ?? []) {
		if (change.action === 'CREATE') {
			const collection = file.collections.get(real(change.variableCollectionId))
			if (!collection) throw badRequest(path, `No variable collection ${change.variableCollectionId}`)
			const id = nextId('VariableID')
			if (change.id) tempIdToRealId[change.id] = id
			file.variables.set(id, {
				id,
				name: change.name,
				key: `${id}-key`,
				variableCollectionId: collection.id,
				resolvedType: change.resolvedType,
				valuesByMode: {},
				remote: false,
				description: change.description ?? '',
				hiddenFromPublishing: change.hiddenFromPublishing ?? false,
				scopes: change.scopes ?? ['ALL_SCOPES'],
				codeSyntax: change.codeSyntax ?? {},
			})
			collection.variableIds.push(id)
			continue
		}
		const variable = file.variables.get(real(change.id))
		if (!variable) throw badRequest(path, `No variable ${change.id}`)
		if (change.action === 'DELETE') {
			file.variables.delete(variable.id)
			const collection = file.collections.get(variable.variableCollectionId)
			if (collection) collection.variableIds = collection.variableIds.filter((id) => id !== variable.id)
			continue
		}
		if (change.name !== undefined) variable.name = change.name
	}

	for (const change of changes.variableModeValues ?? []) {
		const variable = file.variables.get(real(change.variableId))
		if (!variable) throw badRequest(path, `No variable ${change.variableId}`)
		variable.valuesByMode[real(change.modeId)] = change.value as LocalVariable['valuesByMode'][string]
	}

	return tempIdToRealId
}

/** Published entries differ from local ones: they add subscribed_id and drop modes. */
function publishedView(file: FakeFile) {
	return {
		variables: Object.fromEntries(
			[...file.variables.values()].map((variable) => [
				variable.id,
				{
					id: variable.id,
					subscribed_id: `${variable.id}/published`,
					name: variable.name,
					key: variable.key,
					variableCollectionId: variable.variableCollectionId,
					resolvedDataType: variable.resolvedType,
					updatedAt: '2026-01-01T00:00:00Z',
				},
			]),
		),
		variableCollections: Object.fromEntries(
			[...file.collections.values()].map((collection) => [
				collection.id,
				{
					id: collection.id,
					subscribed_id: `${collection.id}/published`,
					name: collection.name,
					key: collection.key,
					updatedAt: '2026-01-01T00:00:00Z',
				},
			]),
		),
	}
}

function createVariablesClient(file: FakeFile = seededFile()): FigmaClient & { file: FakeFile } {
	return {
		file,
		authMode: 'personal',
		async request<T>(spec: FigmaRequest): Promise<T> {
			if (spec.method === 'GET' && spec.path.endsWith('/variables/local')) {
				return {
					variables: Object.fromEntries(file.variables),
					variableCollections: Object.fromEntries(file.collections),
				} as T
			}
			if (spec.method === 'GET' && spec.path.endsWith('/variables/published')) {
				return publishedView(file) as T
			}
			if (spec.method === 'POST' && spec.path.endsWith('/variables')) {
				return {
					tempIdToRealId: applyChanges(file, spec.body as PostVariablesRequestBody, spec.path),
				} as T
			}
			throw new Error(`Unexpected request: ${spec.method} ${spec.path}`)
		},
	}
}

function apiOn(file?: FakeFile) {
	return createVariableApi(createFigmaVariableGateway(createVariablesClient(file ?? seededFile())))
}

describe('variables domain', () => {
	// A fresh file per spec, so the mutating specs cannot leak into the others.
	let api = apiOn()
	beforeEach(() => {
		api = apiOn()
	})

	defineVariableAcceptanceSpecs({ api: () => api, file: () => FILE_KEY, includeMutations: true })()
})

describe(
	'variable list',
	defineListPaginationAcceptanceSpecs({
		model: VARIABLE_LIST_PAGINATION.model,
		list: (opts) => apiOn().list(FILE_KEY, opts),
	}),
)

describe(
	'variable collection list',
	defineListPaginationAcceptanceSpecs({
		model: 'none',
		list: (opts) => apiOn().collections(FILE_KEY, opts),
	}),
)

describe('the double itself', () => {
	it('applies the arrays in the documented order, so later arrays see earlier ids', async () => {
		const api = apiOn()

		const result = await api.apply(FILE_KEY, {
			variableCollections: [{ action: 'CREATE', id: 'tmp_collection', name: 'Spacing', initialModeId: 'tmp_mode' }],
			variables: [
				{
					action: 'CREATE',
					id: 'tmp_variable',
					name: 'space/gap',
					variableCollectionId: 'tmp_collection',
					resolvedType: 'FLOAT',
				},
			],
			variableModeValues: [{ variableId: 'tmp_variable', modeId: 'tmp_mode', value: 8 }],
		})

		const created = (await api.get(FILE_KEY, result.temp_id_to_real_id.tmp_variable as string)) as LocalVariable
		expect(created.variableCollectionId).toBe(result.temp_id_to_real_id.tmp_collection)
		expect(Object.values(created.valuesByMode)).toEqual([8])
	})

	it('refuses a change against an id that is not in the file', async () => {
		await expect(apiOn().apply(FILE_KEY, { variables: [{ action: 'DELETE', id: 'VariableID:9:9' }] })).rejects.toThrow(
			/No variable VariableID:9:9/,
		)
	})
})

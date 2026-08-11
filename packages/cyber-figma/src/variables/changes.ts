import type { PostVariablesRequestBody, VariableResolvedDataType, VariableValue } from '../figma-types.js'

// POST variables is a batch endpoint on an Enterprise-only, seat-gated path:
// a malformed body costs a round trip that most contributors cannot even make,
// and Figma answers it with one message about the first thing it disliked. So
// the change set is checked here first, against the documented limits, and every
// problem is reported at once.
//
// Only what Figma documents is enforced — this never rejects a change set the
// API would have accepted. Anything that depends on the file's current contents
// (does this id exist, is this collection already at 40 modes) is left to Figma,
// because the request is the only thing this layer can see.

const CHANGE_KEYS = ['variableCollections', 'variableModes', 'variables', 'variableModeValues'] as const

const RESOLVED_TYPES: VariableResolvedDataType[] = ['BOOLEAN', 'FLOAT', 'STRING', 'COLOR']

/** Documented in the Variables REST guide; see docs/research/figma-rest-api.md. */
const MAX_MODES_PER_COLLECTION = 40
const MAX_MODE_NAME_LENGTH = 40
const MAX_VARIABLES_PER_COLLECTION = 5000

/** Figma rejects these in a variable name; `/` is allowed and is how groups are spelled. */
const FORBIDDEN_NAME_CHARS = ['.', '{', '}']

const HINT = [
	'A variable change set is a JSON object with any of four arrays, applied in this order:',
	'variableCollections, variableModes, variables, variableModeValues.',
	'Each entry in the first three carries an action of CREATE, UPDATE, or DELETE — CREATE takes a name,',
	'UPDATE and DELETE take the id of an existing object. A CREATE may carry a temporary `id` that later',
	'entries reference; the response maps those to real ids in tempIdToRealId.',
	'Changes written through the API are not visible to other files until the library is published,',
	'which the REST API does not expose.',
].join(' ')

function changeSetError(found: string | string[]): Error {
	const problems = Array.isArray(found) ? found : [found]
	const message =
		problems.length === 1
			? `Invalid variable change set: ${problems[0]}`
			: `Invalid variable change set:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`
	return Object.assign(new Error(message), { hint: HINT })
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(
	entry: Record<string, unknown>,
	key: string,
	where: string,
	problems: string[],
): string | undefined {
	const value = entry[key]
	if (typeof value === 'string' && value !== '') return value
	problems.push(`${where} requires a non-empty ${key}`)
	return undefined
}

function isColor(value: Record<string, unknown>): boolean {
	const channels = ['r', 'g', 'b']
	if (!channels.every((channel) => typeof value[channel] === 'number')) return false
	return value.a === undefined || typeof value.a === 'number'
}

function isAlias(value: unknown): boolean {
	return isRecord(value) && value.type === 'VARIABLE_ALIAS' && typeof value.id === 'string'
}

function isVariableValue(value: unknown): value is VariableValue {
	if (value === null) return true
	if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true
	if (!isRecord(value)) return false
	return isAlias(value) || isColor(value)
}

/** The resolved type a raw value would satisfy, or undefined when it satisfies none. */
function typeOfValue(value: unknown): VariableResolvedDataType | undefined {
	if (typeof value === 'boolean') return 'BOOLEAN'
	if (typeof value === 'number') return 'FLOAT'
	if (typeof value === 'string') return 'STRING'
	if (isRecord(value) && isColor(value)) return 'COLOR'
	return undefined
}

function checkAction(entry: Record<string, unknown>, where: string, problems: string[]): string | undefined {
	const action = entry.action
	if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') return action
	problems.push(
		action === undefined
			? `${where} requires an action of CREATE, UPDATE, or DELETE`
			: `${where} has an unknown action ${JSON.stringify(action)} — expected CREATE, UPDATE, or DELETE`,
	)
	return undefined
}

function checkCollections(entries: unknown[], problems: string[]) {
	entries.forEach((raw, index) => {
		const where = `variableCollections[${index}]`
		if (!isRecord(raw)) {
			problems.push(`${where} must be an object`)
			return
		}
		const action = checkAction(raw, where, problems)
		if (action === 'CREATE') requiredString(raw, 'name', where, problems)
		if (action === 'UPDATE' || action === 'DELETE') requiredString(raw, 'id', where, problems)
	})
}

function checkModes(entries: unknown[], problems: string[]) {
	const createdPerCollection = new Map<string, number>()

	entries.forEach((raw, index) => {
		const where = `variableModes[${index}]`
		if (!isRecord(raw)) {
			problems.push(`${where} must be an object`)
			return
		}
		const action = checkAction(raw, where, problems)

		if (action === 'CREATE' || action === 'UPDATE') {
			const collectionId = requiredString(raw, 'variableCollectionId', where, problems)
			if (action === 'CREATE' && collectionId) {
				createdPerCollection.set(collectionId, (createdPerCollection.get(collectionId) ?? 0) + 1)
			}
		}
		if (action === 'CREATE') requiredString(raw, 'name', where, problems)
		if (action === 'UPDATE' || action === 'DELETE') requiredString(raw, 'id', where, problems)

		const name = raw.name
		if (typeof name === 'string' && name.length > MAX_MODE_NAME_LENGTH) {
			problems.push(
				`${where} name is ${name.length} characters — Figma allows at most ${MAX_MODE_NAME_LENGTH} characters`,
			)
		}
	})

	for (const [collectionId, count] of createdPerCollection) {
		if (count > MAX_MODES_PER_COLLECTION) {
			problems.push(
				`variableModes creates ${count} modes in collection ${collectionId} — a collection holds at most ${MAX_MODES_PER_COLLECTION} modes`,
			)
		}
	}
}

type CreatedVariable = { resolvedType: VariableResolvedDataType }

/** The variables this request creates, by the id later entries would reference. */
function checkVariables(entries: unknown[], problems: string[]): Map<string, CreatedVariable> {
	const created = new Map<string, CreatedVariable>()
	const namesPerCollection = new Map<string, Set<string>>()
	const createdPerCollection = new Map<string, number>()

	entries.forEach((raw, index) => {
		const where = `variables[${index}]`
		if (!isRecord(raw)) {
			problems.push(`${where} must be an object`)
			return
		}
		const action = checkAction(raw, where, problems)

		if (action === 'UPDATE' || action === 'DELETE') requiredString(raw, 'id', where, problems)

		const name = raw.name
		if (typeof name === 'string' && FORBIDDEN_NAME_CHARS.some((char) => name.includes(char))) {
			problems.push(`${where} name ${JSON.stringify(name)} contains a character Figma forbids: . { }`)
		}

		if (action !== 'CREATE') return

		requiredString(raw, 'name', where, problems)
		const collectionId = requiredString(raw, 'variableCollectionId', where, problems)
		const resolvedType = raw.resolvedType
		if (typeof resolvedType !== 'string') {
			problems.push(`${where} requires a resolvedType of ${RESOLVED_TYPES.join(', ')}`)
		} else if (!RESOLVED_TYPES.includes(resolvedType as VariableResolvedDataType)) {
			problems.push(
				`${where} has resolvedType ${JSON.stringify(resolvedType)} — expected one of ${RESOLVED_TYPES.join(', ')}`,
			)
		} else if (typeof raw.id === 'string') {
			created.set(raw.id, { resolvedType: resolvedType as VariableResolvedDataType })
		}

		if (!collectionId) return
		createdPerCollection.set(collectionId, (createdPerCollection.get(collectionId) ?? 0) + 1)
		if (typeof name !== 'string') return
		const names = namesPerCollection.get(collectionId) ?? new Set<string>()
		if (names.has(name)) {
			problems.push(`${where} repeats the name ${JSON.stringify(name)} — variable names are unique within a collection`)
		}
		names.add(name)
		namesPerCollection.set(collectionId, names)
	})

	for (const [collectionId, count] of createdPerCollection) {
		if (count > MAX_VARIABLES_PER_COLLECTION) {
			problems.push(
				`variables creates ${count} variables in collection ${collectionId} — a collection holds at most ${MAX_VARIABLES_PER_COLLECTION} variables`,
			)
		}
	}

	return created
}

function checkModeValues(entries: unknown[], created: Map<string, CreatedVariable>, problems: string[]) {
	entries.forEach((raw, index) => {
		const where = `variableModeValues[${index}]`
		if (!isRecord(raw)) {
			problems.push(`${where} must be an object`)
			return
		}

		const variableId = requiredString(raw, 'variableId', where, problems)
		requiredString(raw, 'modeId', where, problems)

		if (!('value' in raw)) {
			// null is a real value here — it removes an override so the parent's
			// value applies again — so an absent key cannot be treated as one.
			problems.push(`${where} requires a value (use null to remove an override)`)
			return
		}
		if (!isVariableValue(raw.value)) {
			problems.push(
				`${where} value must be a boolean, number, string, color ({r,g,b[,a]}), variable alias ({type:"VARIABLE_ALIAS",id}), or null`,
			)
			return
		}

		// Only the variables this same request creates are checkable; anything
		// already in the file is Figma's to validate.
		const target = variableId ? created.get(variableId) : undefined
		if (!target || raw.value === null || isAlias(raw.value)) return
		const valueType = typeOfValue(raw.value)
		if (valueType !== target.resolvedType) {
			problems.push(
				`${where} value is ${valueType ?? 'of an unknown type'} but variable ${variableId} is created in this request as ${target.resolvedType}`,
			)
		}
	})
}

/**
 * A validated `POST /v1/files/:key/variables` body. Throws with every problem it
 * found, and a hint describing the endpoint, rather than sending a body Figma
 * will reject one field at a time.
 */
export function parseVariableChanges(input: unknown): PostVariablesRequestBody {
	if (!isRecord(input)) {
		throw changeSetError(
			'a change set must be a JSON object with variableCollections, variableModes, variables, and/or variableModeValues',
		)
	}

	const problems: string[] = []
	for (const key of Object.keys(input)) {
		if (!CHANGE_KEYS.includes(key as (typeof CHANGE_KEYS)[number])) {
			problems.push(`unknown key ${JSON.stringify(key)} — expected one of ${CHANGE_KEYS.join(', ')}`)
		}
	}

	const arrays: Partial<Record<(typeof CHANGE_KEYS)[number], unknown[]>> = {}
	for (const key of CHANGE_KEYS) {
		const value = input[key]
		if (value === undefined) continue
		if (!Array.isArray(value)) {
			problems.push(`${key} must be an array`)
			continue
		}
		arrays[key] = value
	}

	const total = CHANGE_KEYS.reduce((sum, key) => sum + (arrays[key]?.length ?? 0), 0)
	if (total === 0 && problems.length === 0) {
		throw changeSetError(
			`a change set must carry at least one entry across ${CHANGE_KEYS.join(', ')} — an empty change set would spend a request to do nothing`,
		)
	}

	if (arrays.variableCollections) checkCollections(arrays.variableCollections, problems)
	if (arrays.variableModes) checkModes(arrays.variableModes, problems)
	const created = arrays.variables ? checkVariables(arrays.variables, problems) : new Map<string, CreatedVariable>()
	if (arrays.variableModeValues) checkModeValues(arrays.variableModeValues, created, problems)

	if (problems.length > 0) throw changeSetError(problems)

	// Figma applies the arrays in this order; sending them in it keeps a body
	// read back from --json in the order it will actually execute.
	return {
		...(arrays.variableCollections && {
			variableCollections: arrays.variableCollections as PostVariablesRequestBody['variableCollections'],
		}),
		...(arrays.variableModes && { variableModes: arrays.variableModes as PostVariablesRequestBody['variableModes'] }),
		...(arrays.variables && { variables: arrays.variables as PostVariablesRequestBody['variables'] }),
		...(arrays.variableModeValues && {
			variableModeValues: arrays.variableModeValues as PostVariablesRequestBody['variableModeValues'],
		}),
	}
}

/** How many objects a change set touches, per array — the acknowledgement an apply prints. */
export function summarizeVariableChanges(changes: PostVariablesRequestBody): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const key of CHANGE_KEYS) {
		const entries = changes[key]
		if (entries?.length) counts[key] = entries.length
	}
	return counts
}

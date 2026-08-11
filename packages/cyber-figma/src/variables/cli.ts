import { readFile } from 'node:fs/promises'
import { Command } from 'commander'
import { addPaginationOptions } from '../cli-options.js'
import type { LocalVariable, LocalVariableCollection, PublishedVariable } from '../figma-types.js'
import { output, printCountSummary, printFields, printNextSteps, printSummary, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import type { VariableApi } from './api.js'
import { VARIABLE_LIST_PAGINATION } from './gateway.js'

// Every command here is Enterprise-gated, reads included. That is a billing
// fact rather than a mistake the caller made, so it is stated up front in the
// help rather than left for a 403 to explain.

const ENTERPRISE_NOTE =
	'Variables requires an Enterprise plan for reading as well as writing; writing also needs a Full seat or admin and Edit access on the file, and is not reachable with a plan access token.'

const FILE_ARG = 'File key or Figma file URL'

type ViewOptions = { published?: boolean }

/** How many modes a variable actually carries a value for — the useful part of valuesByMode in a table. */
function modeCount(variable: LocalVariable | PublishedVariable): string {
	const values = (variable as LocalVariable).valuesByMode
	return values ? String(Object.keys(values).length) : '—'
}

function resolvedType(variable: LocalVariable | PublishedVariable): string {
	return (variable as LocalVariable).resolvedType ?? (variable as PublishedVariable).resolvedDataType ?? ''
}

/** A change set given inline as JSON, or read from a file with `@path`. */
async function readChangeSet(value: string): Promise<unknown> {
	const trimmed = value.trim()
	const path = trimmed.startsWith('@') ? trimmed.slice(1) : undefined

	let text = trimmed
	if (path !== undefined) {
		try {
			text = await readFile(path, 'utf8')
		} catch (error) {
			throw Object.assign(new Error(`Could not read the change set at ${path}: ${(error as Error).message}`), {
				hint: 'Pass --changes @<path> to read a JSON file, or pass the JSON itself as the value.',
			})
		}
	}

	try {
		return JSON.parse(text)
	} catch (error) {
		throw Object.assign(
			new Error(`The change set is not valid JSON${path ? ` (${path})` : ''}: ${(error as Error).message}`),
			{
				hint: 'A change set is a JSON object with any of variableCollections, variableModes, variables, variableModeValues.',
			},
		)
	}
}

export function variableCommand(getApi: () => VariableApi): Command {
	const cmd = new Command('variable')
		.description('Variables and variable collections in a Figma file (Enterprise)')
		.addHelpText('after', `\n${ENTERPRISE_NOTE}\n`)

	addPaginationOptions(
		cmd
			.command('list')
			.description('List the variables in a file')
			.argument('<file>', FILE_ARG)
			.option('--published', 'Read the published library variables instead of the local ones (main file key only)')
			.option('--collection <id>', 'Only the variables in this collection')
			.action(async (file: string, opts: ViewOptions & { collection?: string }) => {
				const result = await getApi().list(file, { published: opts.published, collectionId: opts.collection })
				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'id', get: (variable) => variable.id },
							{ label: 'name', get: (variable) => variable.name },
							{ label: 'type', get: resolvedType },
							{ label: 'collection', get: (variable) => variable.variableCollectionId },
							{ label: 'modes', get: modeCount },
						],
						{ entity: 'variables' },
					)
					printCountSummary(result.count, 'variable(s)')
					printNextSteps([`cyber-figma variable get ${file} <variable-id>`, `cyber-figma variable collections ${file}`])
				})
			}),
		VARIABLE_LIST_PAGINATION,
	)

	cmd
		.command('collections')
		.description('List the variable collections in a file')
		.argument('<file>', FILE_ARG)
		.option('--published', 'Read the published library collections instead of the local ones (main file key only)')
		.action(async (file: string, opts: ViewOptions) => {
			const result = await getApi().collections(file, { published: opts.published })
			output(result, () => {
				printTable(
					result.data,
					[
						{ label: 'id', get: (collection) => collection.id },
						{ label: 'name', get: (collection) => collection.name },
						{
							label: 'modes',
							// The published view omits modes entirely; say so rather than showing an empty cell.
							get: (collection) =>
								(collection as LocalVariableCollection).modes?.map((mode) => mode.name).join(', ') ??
								'(published view omits modes)',
						},
						{
							label: 'variables',
							get: (collection) => String((collection as LocalVariableCollection).variableIds?.length ?? '—'),
						},
					],
					{ entity: 'variable collections' },
				)
				printCountSummary(result.count, 'variable collection(s)')
				printNextSteps([`cyber-figma variable list ${file} --collection <collection-id>`])
			})
		})

	cmd
		.command('get')
		.description('Show one variable, resolving the id a node carries in boundVariables')
		.argument('<file>', FILE_ARG)
		.argument('<variable-id>', 'Variable id, e.g. VariableID:1:2')
		.option('--published', 'Read the published library variables instead of the local ones')
		.action(async (file: string, variableId: string, opts: ViewOptions) => {
			const variable = await getApi().get(file, variableId, { published: opts.published })
			output(variable, () => {
				const local = variable as LocalVariable
				printFields({
					id: variable.id,
					name: variable.name,
					key: variable.key,
					type: resolvedType(variable),
					collection: variable.variableCollectionId,
					description: truncate(local.description, { full: isFull() }),
					scopes: local.scopes?.join(', '),
					remote: local.remote === undefined ? undefined : String(local.remote),
					hidden_from_publishing:
						local.hiddenFromPublishing === undefined ? undefined : String(local.hiddenFromPublishing),
					subscribed_id: (variable as PublishedVariable).subscribed_id,
				})
				if (local.valuesByMode) {
					printSummary('\nvalues by mode:')
					for (const [modeId, value] of Object.entries(local.valuesByMode)) {
						printSummary(`  ${modeId}  ${truncate(JSON.stringify(value), { full: isFull() })}`)
					}
				}
				printNextSteps([`cyber-figma variable collections ${file}`])
			})
		})

	cmd
		.command('apply')
		.description('Create, update, and delete variables in one batch request')
		.argument('<file>', FILE_ARG)
		.requiredOption(
			'--changes <json>',
			'The change set: JSON inline, or @<path> to read it from a file. Keys: variableCollections, variableModes, variables, variableModeValues',
		)
		.option('--dry-run', 'Validate the change set and report what it would touch, without sending it')
		.addHelpText(
			'after',
			[
				'',
				ENTERPRISE_NOTE,
				'',
				'Arrays are applied in this order, and in array order within each: variableCollections,',
				'variableModes, variables, variableModeValues. A CREATE may carry a temporary id that later',
				'entries reference; the response maps those to the real ids Figma assigned.',
				'',
				'Changes are visible only in this file until the library is published, which the REST API',
				'does not expose — publishing is a Figma UI action.',
				'',
				'Example:',
				'  cyber-figma variable apply <file> --changes @changes.json --dry-run',
			].join('\n'),
		)
		.action(async (file: string, opts: { changes: string; dryRun?: boolean }) => {
			const changes = await readChangeSet(opts.changes)

			if (opts.dryRun) {
				const checked = getApi().validate(changes)
				output({ ...checked, dry_run: true }, () => {
					printFields({ dry_run: 'the change set is valid and was not sent' })
					printSummary('\nwould change:')
					for (const [key, count] of Object.entries(checked.changes)) printSummary(`  ${key}  ${count}`)
					printNextSteps([`cyber-figma variable apply ${file} --changes ${opts.changes}`])
				})
				return
			}

			const result = await getApi().apply(file, changes)
			output(result, () => {
				printSummary('changed:')
				for (const [key, count] of Object.entries(result.changes)) printSummary(`  ${key}  ${count}`)
				const mapped = Object.entries(result.temp_id_to_real_id)
				if (mapped.length > 0) {
					printSummary('\ntemporary id → real id:')
					for (const [temp, real] of mapped) printSummary(`  ${temp}  ${real}`)
				}
				printSummary(`\n${result.note}`)
				printNextSteps([`cyber-figma variable list ${file}`])
			})
		})

	return cmd
}

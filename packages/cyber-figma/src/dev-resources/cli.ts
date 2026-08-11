import { Command } from 'commander'
import { addPaginationOptions, type PaginationCliOptions, paginationOptionsFromCli } from '../cli-options.js'
import { deleteMessage } from '../idempotent-delete.js'
import { output, printCountSummary, printNextSteps, printSummary, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import { normalizeNodeIds } from '../url.js'
import type { DevResourceApi } from './api.js'
import { DEV_RESOURCE_LIST_PAGINATION } from './gateway.js'
import type { DevResourceWriteResult } from './write-result.js'

const MAIN_FILE_NOTE = 'File key or Figma file URL — a MAIN file, not a branch'

/**
 * What a bulk write actually did. Figma answers these two endpoints with a 200
 * even when items failed, so the count line leads with how many of the
 * requested items landed and every rejection is printed by name.
 */
function printWriteResult(result: DevResourceWriteResult) {
	const verb = result.action === 'create' ? 'created' : 'updated'
	printTable(
		result.dev_resources,
		[
			{ label: 'id', get: (resource) => resource.id },
			{ label: 'node', get: (resource) => resource.node_id },
			{ label: 'name', get: (resource) => truncate(resource.name, { full: isFull() }) },
			{ label: 'url', get: (resource) => truncate(resource.url, { full: isFull() }) },
		],
		{ entity: `dev resources ${verb}` },
	)
	printSummary(`\n${result.succeeded} of ${result.requested} dev resource(s) ${verb}`)
	if (result.failed === 0) return
	printSummary(`${result.failed} rejected by Figma inside a 200 response:`)
	for (const error of result.errors) {
		const at = [error.id, error.file_key, error.node_id].filter(Boolean).join(' ')
		printSummary(`  - ${at || '(unidentified item)'}: ${error.error}`)
	}
}

export function devResourceCommand(getApi: () => DevResourceApi): Command {
	const cmd = new Command('dev-resource')
		.description('Dev Mode resources — developer links attached to file nodes')
		.addHelpText(
			'after',
			[
				'',
				'Every endpoint here takes a main file key, never a branch key.',
				'Links are live the moment they are written — dev resources are not published like',
				'  components, styles, or variables, so they also apply to already-published components.',
				'Reading needs any file access; writing needs edit access. A node holds at most 10 links,',
				'  and two links on the same node may not share a URL.',
				'The REST endpoints carry no plan gate, but the surface these links appear in does: Dev Mode',
				'  is available on paid plans and needs a Full or a Dev seat. On a plan or seat without it',
				'  the API still answers — the links simply are not visible in the product.',
				'create and update are bulk writes that answer 200 even when items fail: the result reports',
				'  ok, succeeded, failed, and every rejection. The command exits nonzero only when nothing',
				'  was written.',
			].join('\n'),
		)

	addPaginationOptions(
		cmd
			.command('list')
			.description('List the dev resources attached to a file')
			.argument('<file>', MAIN_FILE_NOTE)
			.option('--node-ids <ids>', 'Only dev resources on these nodes (comma-separated; default: the whole file)')
			.action(async (file: string, opts: PaginationCliOptions & { nodeIds?: string }) => {
				const result = await getApi().list(file, { ...paginationOptionsFromCli(opts), nodeIds: opts.nodeIds })
				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'id', get: (resource) => resource.id },
							{ label: 'node', get: (resource) => resource.node_id },
							{ label: 'name', get: (resource) => truncate(resource.name, { full: isFull() }) },
							{ label: 'url', get: (resource) => truncate(resource.url, { full: isFull() }) },
						],
						{ entity: 'dev resources' },
					)
					printCountSummary(result.count, 'dev resource(s)')
					printNextSteps([
						`cyber-figma dev-resource create ${file} --node <node-id> --name <name> --url <url>`,
						`cyber-figma dev-resource delete ${file} <dev-resource-id>`,
					])
				})
			}),
		DEV_RESOURCE_LIST_PAGINATION,
	)

	cmd
		.command('create')
		.description('Attach a link to one or more nodes in a file')
		.argument('<file>', MAIN_FILE_NOTE)
		.requiredOption('--node <ids>', 'Node ids to attach the link to (comma-separated)')
		.requiredOption('--name <name>', 'Display name of the link')
		.requiredOption('--url <url>', 'URL the link points at')
		.action(async (file: string, opts: { node: string; name: string; url: string }) => {
			const result = await getApi().create(
				normalizeNodeIds(opts.node).map((nodeId) => ({ file, nodeId, name: opts.name, url: opts.url })),
			)
			output(result, () => {
				printWriteResult(result)
				printNextSteps([`cyber-figma dev-resource list ${file} --node-ids ${opts.node}`])
			})
		})

	cmd
		.command('update')
		.description('Rename a dev resource or point it at a different URL')
		.argument('<dev-resource-id>', 'Id of the dev resource, from `dev-resource list`')
		.option('--name <name>', 'New display name')
		.option('--url <url>', 'New URL')
		.action(async (devResourceId: string, opts: { name?: string; url?: string }) => {
			const result = await getApi().update([{ id: devResourceId, name: opts.name, url: opts.url }])
			output(result, () => printWriteResult(result))
		})

	cmd
		.command('delete')
		.description('Remove a dev resource from a file')
		.argument('<file>', MAIN_FILE_NOTE)
		.argument('<dev-resource-id>', 'Id of the dev resource, from `dev-resource list`')
		.action(async (file: string, devResourceId: string) => {
			const result = await getApi().remove(file, devResourceId)
			output(result, () => printSummary(deleteMessage(result, 'Dev resource')))
		})

	return cmd
}

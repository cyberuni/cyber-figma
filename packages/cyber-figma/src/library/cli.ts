import { Command } from 'commander'
import { addPaginationOptions, type PaginationCliOptions, paginationOptionsFromCli } from '../cli-options.js'
import type { PublishedStyle } from '../figma-types.js'
import { output, printCountSummary, printFields, printNextSteps, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import type { LibraryApi } from './api.js'
import { libraryTeamListPagination, type PublishedLibraryItem } from './gateway.js'
import { LIBRARY_SCOPES, type LibraryResource, MAIN_FILE_KEY_NOTE, publishedOnlyNote } from './resources.js'

// One set of Commander bindings for all three families: components, component
// sets, and styles take the same three endpoints with the same parameters, and
// differ only in their nouns and in the one field styles have.

/** `style_type` exists on the style family only. */
function styleType(item: PublishedLibraryItem): string {
	return 'style_type' in item ? ((item as PublishedStyle).style_type ?? '') : ''
}

function columns(resource: LibraryResource) {
	const base = [
		{ label: 'key', get: (item: PublishedLibraryItem) => item.key },
		{ label: 'name', get: (item: PublishedLibraryItem) => item.name },
	]
	const tail = [
		{ label: 'file_key', get: (item: PublishedLibraryItem) => item.file_key },
		{ label: 'node_id', get: (item: PublishedLibraryItem) => item.node_id },
		{ label: 'updated_at', get: (item: PublishedLibraryItem) => item.updated_at },
	]
	return resource.family === 'styles' ? [...base, { label: 'style_type', get: styleType }, ...tail] : [...base, ...tail]
}

export function libraryCommand(resource: LibraryResource, getApi: () => LibraryApi): Command {
	const published = publishedOnlyNote(resource)
	const teamSpec = libraryTeamListPagination(resource.family)
	const cmd = new Command(resource.domain).description(`Published library ${resource.plural}`)

	function printList(items: PublishedLibraryItem[], nextSteps: string[]) {
		printTable(items, columns(resource), { entity: resource.plural })
		printCountSummary(items.length, `${resource.label}(s)`)
		printNextSteps(nextSteps)
	}

	addPaginationOptions(
		cmd
			.command('team-list')
			.description(`List a team's published library ${resource.plural}. ${published}`)
			.argument('[team]', 'Team id or team URL — defaults to --team, then FIGMA_TEAM_ID')
			.addHelpText('after', `\nScope required: ${LIBRARY_SCOPES.team}`)
			.action(async (team: string | undefined, opts: PaginationCliOptions) => {
				const result = await getApi().listByTeam(team, paginationOptionsFromCli(opts))
				output(result, () => {
					printList(result.data, [
						`cyber-figma ${resource.domain} get <key>`,
						`cyber-figma ${resource.domain} file-list <file>`,
						// The team lists advance with --after, not --cursor: the cursor is an
						// opaque integer bound, and --cursor would re-request page one forever.
						...(result.next_cursor ? [`cyber-figma ${resource.domain} team-list --after ${result.next_cursor}`] : []),
					])
				})
			}),
		teamSpec,
	)

	cmd
		.command('file-list')
		.description(`List the published library ${resource.plural} of one file. ${published}`)
		.argument('<file>', `File key or Figma file URL. ${MAIN_FILE_KEY_NOTE}`)
		.addHelpText('after', `\nScope required: ${LIBRARY_SCOPES.file}`)
		.action(async (file: string) => {
			const result = await getApi().listByFile(file)
			output(result, () => {
				printList(result.data, [`cyber-figma ${resource.domain} get <key>`])
			})
		})

	cmd
		.command('get')
		.description(`Get one published library ${resource.label} by its key. ${published}`)
		.argument('<key>', `Library key of the published ${resource.label} — not a node id`)
		.addHelpText('after', `\nScope required: ${LIBRARY_SCOPES.key}`)
		.action(async (key: string) => {
			const item = await getApi().get(key)
			output(item, () => {
				printFields({
					key: item.key,
					name: item.name,
					...(resource.family === 'styles' && { style_type: styleType(item) }),
					description: truncate(item.description, { full: isFull() }),
					file_key: item.file_key,
					node_id: item.node_id,
					updated_at: item.updated_at,
					created_at: item.created_at,
					updated_by: item.user?.handle,
					thumbnail_url: item.thumbnail_url,
				})
				printNextSteps([`cyber-figma ${resource.domain} file-list ${item.file_key}`])
			})
		})

	return cmd
}

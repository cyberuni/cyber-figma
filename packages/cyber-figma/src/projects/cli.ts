import { Command } from 'commander'
import { addPaginationOptions, type PaginationCliOptions, paginationOptionsFromCli } from '../cli-options.js'
import { output, printCountSummary, printFields, printNextSteps, printTable } from '../output.js'
import type { ProjectApi } from './api.js'
import { PROJECT_FILE_LIST_PAGINATION, PROJECT_LIST_PAGINATION } from './gateway.js'

export function projectCommand(getApi: () => ProjectApi): Command {
	const cmd = new Command('project').description('Projects in a Figma team, and the files inside them')

	addPaginationOptions(
		cmd
			.command('list')
			.description('List the projects of a team')
			.argument('[team]', 'Team id or team URL (default: --team / FIGMA_TEAM_ID)')
			.action(async (team: string | undefined, opts: PaginationCliOptions) => {
				const result = await getApi().list(team, paginationOptionsFromCli(opts))
				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'id', get: (project) => project.id },
							{ label: 'name', get: (project) => project.name },
						],
						{ entity: 'projects' },
					)
					printCountSummary(result.count, 'project(s)')
					// The discovery walk: a team id is the only identifier Figma will not
					// hand you, and from a project id the file keys are one call away.
					printNextSteps(
						result.data.length > 0
							? [`cyber-figma project files ${result.data[0].id}`, `cyber-figma project get ${result.data[0].id}`]
							: [],
					)
				})
			}),
		PROJECT_LIST_PAGINATION,
	)

	cmd
		.command('get')
		.description('Read the metadata of a project')
		.argument('<project>', 'Project id or project URL')
		.action(async (project: string) => {
			const meta = await getApi().get(project)
			output(meta, () => {
				printFields({
					id: meta.id,
					name: meta.name,
					files: String(meta.file_count),
					created: meta.created_at,
					updated: meta.updated_at,
					thumbnail: meta.thumbnail_url,
				})
				printNextSteps([`cyber-figma project files ${meta.id}`])
			})
		})

	addPaginationOptions(
		cmd
			.command('files')
			.description('List the files in a project')
			.argument('<project>', 'Project id or project URL')
			.option('--branch-data', 'Include branch metadata for each main file that has branches')
			.action(async (project: string, opts: PaginationCliOptions & { branchData?: boolean }) => {
				const result = await getApi().files(project, {
					...paginationOptionsFromCli(opts),
					branchData: opts.branchData,
				})
				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'key', get: (file) => file.key },
							{ label: 'name', get: (file) => file.name },
							{ label: 'last modified', get: (file) => file.last_modified },
						],
						{ entity: 'files' },
					)
					printCountSummary(result.count, 'file(s)')
					printNextSteps(
						result.data.length > 0
							? [`cyber-figma file get ${result.data[0].key}`, `cyber-figma comment list ${result.data[0].key}`]
							: [],
					)
				})
			}),
		PROJECT_FILE_LIST_PAGINATION,
	)

	return cmd
}

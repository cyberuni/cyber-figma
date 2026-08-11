import { Command, InvalidArgumentError } from 'commander'
import { output, printCountSummary, printNextSteps, printSummary, printTable } from '../output.js'
import type { DiscoveryApi } from './api.js'

type TextEventsCliOptions = {
	startDate: string
	endDate?: string
	fileTtl?: number
}

function parseTtl(value: string): number {
	const ttl = Number(value)
	if (!Number.isInteger(ttl)) throw new InvalidArgumentError('file-ttl must be a whole number of seconds')
	return ttl
}

export function discoveryCommand(getApi: () => DiscoveryApi): Command {
	const cmd = new Command('discovery').description(
		'Organization text-event export — in-file text, cursor chat, comments, component documentation, Dev Mode annotations, and AI prompts. Requires an Enterprise plan with the Governance+ add-on and an org admin, and is reachable with OAuth 2 only (--auth-mode oauth, scope org:discovery_read): neither a personal nor a plan access token can read it.',
	)

	cmd
		.command('text-events')
		.description('Download links for the text events in a window (one JSON file per hour)')
		.requiredOption(
			'--start-date <instant>',
			'Start of the window, ISO 8601 UTC. Must be at least one hour in the past',
		)
		.option(
			'--end-date <instant>',
			'End of the window, ISO 8601 UTC. At most 24 hours after the start (default: one hour after)',
		)
		.option('--file-ttl <seconds>', 'How long the links stay valid: 60–86400 (Figma default: 86400)', parseTtl)
		.action(async (opts: TextEventsCliOptions) => {
			const result = await getApi().textEvents({
				startDate: opts.startDate,
				endDate: opts.endDate,
				fileTtlSeconds: opts.fileTtl,
			})

			output(result, () => {
				printTable(
					result.hours,
					[
						{ label: 'hour', get: (hour) => hour.hour },
						{ label: 'files', get: (hour) => String(hour.urls.length) },
						{ label: 'first url', get: (hour) => hour.urls[0] ?? '' },
					],
					{ entity: 'hours' },
				)
				printCountSummary(result.total_urls, 'download link(s)')
				// The links are the answer, not the data: saying so stops a caller
				// treating an empty-looking table as "no events".
				printSummary(
					'\nThis endpoint returns links, not events: fetch each URL to get that hour’s JSON. The links expire (--file-ttl, default 24h) and can be regenerated for the same window at any time.',
				)
				printNextSteps([
					`cyber-figma discovery text-events --start-date ${opts.startDate} --json  # every url, machine-readable`,
				])
			})
		})

	return cmd
}

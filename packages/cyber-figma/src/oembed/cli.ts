import { Command, InvalidArgumentError } from 'commander'
import { output, printFields, printNextSteps } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import type { OEmbedApi } from './api.js'

function parsePixels(value: string): number {
	const pixels = Number(value)
	if (!Number.isInteger(pixels) || pixels < 1) throw new InvalidArgumentError('must be a positive integer')
	return pixels
}

export function oembedCommand(getApi: () => OEmbedApi): Command {
	const cmd = new Command('oembed').description('Embed metadata for a Figma file or published Make URL (oEmbed 1.0)')

	cmd
		.command('get')
		.description('Describe a Figma file or published Make URL as an embeddable resource')
		.argument('<url>', 'Figma file URL or published Make site URL — a link, not a file key')
		.option('--max-width <pixels>', 'Maximum embed width (default: 800; adjusted to keep 16:9)', parsePixels)
		.option('--max-height <pixels>', 'Maximum embed height (default: 450; adjusted to keep 16:9)', parsePixels)
		.action(async (url: string, opts: { maxWidth?: number; maxHeight?: number }) => {
			const embed = await getApi().get(url, { maxWidth: opts.maxWidth, maxHeight: opts.maxHeight })
			output(embed, () => {
				printFields({
					title: embed.title,
					key: embed.key,
					url: embed.url,
					provider: embed.provider_name,
					folder: embed.folder_name,
					size: `${embed.width}x${embed.height}`,
					thumbnail: embed.thumbnail_url,
					// The iframe markup is the largest field by far and is rarely what
					// a terminal reader wants in full.
					html: truncate(embed.html, { full: isFull() }),
				})
				printNextSteps(embed.key ? [`cyber-figma file get ${embed.key}`] : [])
			})
		})

	return cmd
}

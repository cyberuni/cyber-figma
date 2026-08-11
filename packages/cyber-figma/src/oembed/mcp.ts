import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { OEmbedApi } from './api.js'

export function registerOEmbedTools(server: McpServer, getApi: () => OEmbedApi) {
	server.tool(
		'figma_oembed_get',
		'Describe a Figma file or published Make URL as an embeddable resource (oEmbed 1.0): title, thumbnail, file key, and iframe HTML. Cheaper than reading the file, and not reachable with a plan access token.',
		{
			url: z.string().describe('Figma file URL or published Make site URL — a link, not a file key'),
			max_width: z.number().int().min(1).optional().describe('Maximum embed width in pixels (default 800)'),
			max_height: z.number().int().min(1).optional().describe('Maximum embed height in pixels (default 450)'),
		},
		async ({ url, max_width, max_height }) => ({
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(await getApi().get(url, { maxWidth: max_width, maxHeight: max_height })),
				},
			],
		}),
	)
}

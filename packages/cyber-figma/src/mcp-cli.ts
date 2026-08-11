import { Command } from 'commander'
import type { RuntimeContext } from './composition.js'
import { startMcpServer } from './mcp-server.js'

/**
 * `cyber-figma mcp` — the same stdio server as the `./mcp` entry, reachable
 * through the installed binary so an MCP client config needs one command rather
 * than a path into the package's dist.
 */
export function mcpCommand(getContext: () => RuntimeContext) {
	return new Command('mcp').description('Run the stdio MCP server').action(async () => {
		await startMcpServer(getContext)
	})
}

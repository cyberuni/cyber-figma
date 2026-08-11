#!/usr/bin/env node
import { Command } from 'commander'
import { exitCodeFor, renderCliError } from './cli-error.js'
import { installUsageErrors, isCleanCommanderExit } from './cli-usage.js'
import { type FigmaAuthMode, parseAuthMode, setAuthModeOverride, setTokenOverride } from './client.js'
import { createRuntimeContext, DOMAINS, type RuntimeContext, registerCliCommands } from './composition.js'
import { DESCRIPTION, runDefaultCommand } from './default-command.js'
import { mcpCommand } from './mcp-cli.js'
import { selectFormat } from './output.js'
import { readRepoConfig } from './repo-config.js'
import { setRepoConfigTeamId, setTeamOverride } from './scope.js'
import { VERSION } from './version.js'

const program = new Command()
let runtimeContext: RuntimeContext | undefined

// Built on first use, so --help and usage errors never need a credential.
function getRuntimeContext() {
	runtimeContext ??= createRuntimeContext()
	return runtimeContext
}

program
	.name('cyber-figma')
	.description(DESCRIPTION)
	.version(VERSION)
	.option('--token <token>', 'Figma access token — overrides FIGMA_ACCESS_TOKEN')
	.option('--team <id>', 'Figma team id or team URL — overrides FIGMA_TEAM_ID')
	.option('--auth-mode <mode>', 'How to send the token: personal, plan, or oauth (default: personal)')
	.option('--json', 'Output raw JSON instead of formatted text')
	.option('--toon', 'Output token-efficient TOON instead of formatted text (recommended for agents)')
	.option('--full', 'Show full field values instead of truncating large text')
	.addHelpText(
		'after',
		[
			'',
			'Authentication: set FIGMA_ACCESS_TOKEN (Figma Settings → Security) or pass --token <pat>.',
			'  Personal access tokens expire after at most 90 days, and Figma reports an expired',
			'  token as 403, not 401. For CI, an org admin can mint a plan access token: run it with',
			'  --auth-mode plan. Plan tokens cannot reach /v1/me, /v1/oembed, comment writes, or',
			'  variable writes.',
			'Team: Figma has no API that discovers a team id from a token. Copy the id after /team/',
			'  in your team URL into FIGMA_TEAM_ID, or pass --team <id>.',
			'Output: default is human-readable text; use --toon for token-efficient agent output or',
			'  --json for raw JSON.',
			'',
			'Exit codes: 0 ok, 1 error, 2 usage, 3 auth/config, 4 forbidden, 5 not found,',
			'  6 rate limited, 7 above the plan level.',
			'',
			'Examples:',
			'  cyber-figma                       # show configuration and available resources',
			'  cyber-figma <resource> --help     # concise per-resource reference',
		].join('\n'),
	)
	.hook('preAction', async () => {
		const opts = program.opts<{ token?: string; team?: string; authMode?: string }>()
		if (opts.token) setTokenOverride(opts.token)
		if (opts.team) setTeamOverride(opts.team)
		if (opts.authMode) setAuthModeOverride(parseAuthMode(opts.authMode) as FigmaAuthMode)
		// The repo's own config is the last-resort team id, so a checked-out repo
		// is self-describing. A malformed one is reported rather than ignored.
		setRepoConfigTeamId((await readRepoConfig(process.cwd()))?.team_id)
	})
	.action(() => {
		runDefaultCommand({ domains: DOMAINS })
	})

registerCliCommands(program, getRuntimeContext)
program.addCommand(mcpCommand(getRuntimeContext))
installUsageErrors(program)

program.parseAsync(process.argv).catch((err: unknown) => {
	// --help and --version reach here as Commander "exits", not failures.
	if (isCleanCommanderExit(err)) process.exit(err.exitCode ?? 0)
	console.error(renderCliError(err, selectFormat()))
	process.exit(exitCodeFor(err))
})

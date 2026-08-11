import { homedir } from 'node:os'
import { type FigmaAuthMode, getTokenOverride, parseAuthMode } from './client.js'
import type { AnyDomain } from './composition.js'
import { envValue } from './env.js'
import { output, printEmpty, printFields, printNextSteps, printSummary } from './output.js'
import { optionalTeamId } from './scope.js'

// AXI principles 8 and 10: running with no arguments shows live state and
// identifies the tool. An agent that sees actual state can act immediately; one
// that sees a usage manual has to make a second call.

export const DESCRIPTION = 'Figma REST API CLI and MCP server for AI agents'

export type HomeView = {
	bin: string
	description: string
	auth: { configured: boolean; mode: FigmaAuthMode }
	team: string | null
	resources: string[]
	next_steps: string[]
}

export type HomeViewOptions = {
	domains: AnyDomain[]
	bin?: string
	home?: string
}

/** The executable path with the user's home collapsed to `~`. */
function collapseHome(bin: string, home: string): string {
	return home && bin.startsWith(home) ? `~${bin.slice(home.length)}` : bin
}

function authMode(): FigmaAuthMode {
	try {
		return parseAuthMode(envValue('FIGMA_AUTH_MODE')) ?? 'personal'
	} catch {
		// An invalid FIGMA_AUTH_MODE is reported by the command that uses it; the
		// home view should still render.
		return 'personal'
	}
}

export function renderHomeView(options: HomeViewOptions): HomeView {
	const bin = options.bin ?? process.argv[1] ?? 'cyber-figma'
	// A configured token is reported as a boolean and never echoed — the home
	// view goes to stdout, which is exactly where a credential must not go.
	const configured = Boolean(getTokenOverride() ?? envValue('FIGMA_ACCESS_TOKEN'))
	const team = optionalTeamId() ?? null
	const resources = options.domains.map((domain) => domain.name)

	const next_steps: string[] = []
	if (!configured) {
		next_steps.push(
			'Set FIGMA_ACCESS_TOKEN to a personal access token from Figma Settings → Security, or pass --token <pat>',
		)
	}
	if (configured && !team) {
		next_steps.push(
			'Set FIGMA_TEAM_ID to the id after /team/ in your team URL (Figma cannot discover it from a token), or pass --team <id>',
		)
	}
	if (resources.length === 0) {
		next_steps.push('This build ships no resource commands yet — only the shared spine is installed')
	} else {
		next_steps.push(`Run \`cyber-figma <resource> --help\` for one of: ${resources.join(', ')}`)
		next_steps.push('Add --toon for token-efficient output, or --json for raw JSON')
	}

	return {
		bin: collapseHome(bin, options.home ?? homedir()),
		description: DESCRIPTION,
		auth: { configured, mode: authMode() },
		team,
		resources,
		next_steps,
	}
}

export function runDefaultCommand(options: HomeViewOptions): void {
	const view = renderHomeView(options)
	output(view, () => {
		printFields({
			bin: view.bin,
			description: view.description,
			auth: view.auth.configured ? `configured (${view.auth.mode})` : 'not configured',
			team: view.team ?? 'not set',
		})
		console.log('')
		if (view.resources.length === 0) printEmpty('resource commands')
		else printSummary(`resources: ${view.resources.join(', ')}`)
		printNextSteps(view.next_steps)
	})
}

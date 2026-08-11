// Canonical name → the variables consulted for it, in precedence order. The
// aliases exist so a shell that already exports the shorter name keeps working;
// the canonical name is what the rest of the codebase asks for.
const ENV_ALIASES: Partial<Record<string, string[]>> = {
	FIGMA_ACCESS_TOKEN: ['FIGMA_ACCESS_TOKEN', 'FIGMA_TOKEN'],
	FIGMA_TEAM_ID: ['FIGMA_TEAM_ID', 'FIGMA_TEAM'],
}

// An agent host that cannot expand a `${VAR}` reference — a plugin client that
// implements only the Agent Plugins placeholders, or Claude Code when the
// variable is unset — forwards the reference text verbatim. Without this guard
// the placeholder reads as a real value: it shadows the alias, and a missing
// credential surfaces as a Figma 403 rather than as missing.
const UNEXPANDED_PLACEHOLDER = /^\$\{[A-Za-z_][A-Za-z0-9_]*(?::[-=?+][^}]*)?\}$/

/** Whether a value is nothing but a `${VAR}` reference the host failed to expand. */
export function isUnexpandedPlaceholder(value: string): boolean {
	return UNEXPANDED_PLACEHOLDER.test(value)
}

export function envValue(name: string): string | undefined {
	const candidates = ENV_ALIASES[name] ?? [name]
	for (const candidate of candidates) {
		const value = process.env[candidate]
		if (value !== undefined && value !== '' && !isUnexpandedPlaceholder(value)) {
			return value
		}
	}
	return undefined
}

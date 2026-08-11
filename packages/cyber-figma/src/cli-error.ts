import { buildUsageErrorBody, isUsageError, renderUsageErrorText } from './cli-usage.js'
import { buildFigmaErrorBody } from './figma-error.js'
import type { OutputFormat } from './output.js'
import { encodeToon } from './toon.js'

// Meaningful, stable exit codes — AXI principle 6. 0 success, 1 generic
// failure, then the specific recoverable conditions an agent can branch on
// without parsing the message.
export function exitCodeFor(error: unknown): number {
	if (isUsageError(error)) return 2 // the caller can fix the command line and retry
	const body = buildFigmaErrorBody(error)
	if (body.error.kind === 'config') return 3
	switch (body.error.reason) {
		case 'plan_gated':
			// A billing fact, not a permission mistake, and retrying never helps.
			return 7
		case 'unauthenticated':
			return 3
		case 'forbidden':
			return 4
		case 'not_found':
			return 5
		case 'rate_limited':
			return 6
		default:
			return 1
	}
}

export function renderCliError(error: unknown, format: OutputFormat): string {
	if (isUsageError(error)) {
		const usage = buildUsageErrorBody(error)
		if (format === 'json') return JSON.stringify(usage, null, 2)
		if (format === 'toon') return encodeToon(usage)
		return renderUsageErrorText(error)
	}
	const body = buildFigmaErrorBody(error)
	if (format === 'json') return JSON.stringify(body, null, 2)
	if (format === 'toon') return encodeToon(body)
	const prefix = body.error.kind === 'figma_api' ? 'Figma API error' : 'Error'
	let text = `${prefix}: ${body.error.message}`
	if (body.error.hint) text += `\nHint: ${body.error.hint}`
	return text
}

import { encodeToon } from './toon.js'
import { isFull } from './truncate.js'

export type OutputFormat = 'json' | 'toon' | 'text'

export function selectFormat(argv: string[] = process.argv): OutputFormat {
	if (argv.includes('--toon')) return 'toon'
	if (argv.includes('--json')) return 'json'
	return 'text'
}

function printJson(data: unknown) {
	console.log(JSON.stringify(data, null, 2))
}

/** Definitive empty state — principle 5. */
export function printEmpty(entity?: string) {
	console.log(entity ? `0 ${entity} found` : '0 results')
}

export function printFields(fields: Record<string, string | null | undefined>) {
	const entries = Object.entries(fields).filter(([, v]) => v != null) as [string, string][]
	const width = Math.max(...entries.map(([k]) => k.length))
	for (const [key, val] of entries) {
		console.log(`${key.padEnd(width)}  ${val}`)
	}
}

/**
 * A table column. `max` caps a free-text column so one long value cannot
 * stretch every row; leave it off for ids and URLs, which are useless cut.
 */
export interface TableColumn<T> {
	label: string
	get: (item: T) => string
	max?: number
}

export function printTable<T>(items: T[], cols: TableColumn<T>[], opts?: { entity?: string; full?: boolean }) {
	if (items.length === 0) {
		printEmpty(opts?.entity)
		return
	}
	const full = opts?.full ?? isFull()
	let cut = false
	// A line break inside a cell would start a new row, so every cell is one line.
	const rows = items.map((item) =>
		cols.map((c) => {
			const value = c.get(item).replace(/\s*[\r\n]+\s*/g, ' ')
			if (full || c.max === undefined || value.length <= c.max) return value
			cut = true
			return `${value.slice(0, c.max - 1)}…`
		}),
	)
	const widths = cols.map((c, i) => Math.max(c.label.length, ...rows.map((r) => r[i].length)))
	console.log(cols.map((c, i) => c.label.toUpperCase().padEnd(widths[i])).join('  '))
	console.log(widths.map((w) => '-'.repeat(w)).join('  '))
	for (const row of rows) {
		console.log(row.map((cell, i) => cell.padEnd(widths[i])).join('  '))
	}
	if (cut) console.log('\nLong values are cut to fit the table; use --full to see them whole.')
}

/** Aggregate summary line — principle 4. Text mode only. */
export function printSummary(line: string, argv: string[] = process.argv) {
	if (selectFormat(argv) !== 'text') return
	console.log(line)
}

/**
 * Pre-computed count aggregate — principle 4. Text mode only.
 * `noun` carries its own plural marker, e.g. 'project(s)'. Empty results say
 * nothing here; the empty state (principle 5) has already spoken.
 */
export function printCountSummary(count: number, noun: string, argv: string[] = process.argv) {
	if (count === 0) return
	printSummary(`\n${count} ${noun}`, argv)
}

/** Contextual next-step suggestions — principle 9. Text mode only. */
export function printNextSteps(steps: string[], argv: string[] = process.argv) {
	if (steps.length === 0 || selectFormat(argv) !== 'text') return
	console.log('\nNext steps:')
	for (const step of steps) console.log(`  - ${step}`)
}

export function output(data: unknown, readable: () => void, argv: string[] = process.argv) {
	switch (selectFormat(argv)) {
		case 'toon':
			console.log(encodeToon(data))
			break
		case 'json':
			printJson(data)
			break
		default:
			readable()
	}
}

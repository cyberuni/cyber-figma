import { describe } from 'vitest'
import { collectPages, type PaginationSpec } from '../pagination.js'
import { defineListPaginationAcceptanceSpecs } from './list-pagination.acceptance.js'
import { createPaginatingClient } from './paginating-gateway.js'

// The factory a domain pod reuses in both its *.acceptance.test.ts (against
// doubles) and its *.system.ts (against the live API). Running it here against
// the double proves the two halves of the kit agree.
function listFor(spec: PaginationSpec, pages: unknown[][]) {
	const client = createPaginatingClient(spec, pages)
	return (opts = {}) => collectPages(spec, (o) => client.request({ method: 'GET', path: '/v1/example' }, o), opts)
}

describe(
	'a paginated list (row_cursor)',
	defineListPaginationAcceptanceSpecs({
		model: 'row_cursor',
		list: listFor({ model: 'row_cursor', itemsKey: 'rows' }, [['a'], ['b'], ['c']]),
	}),
)

describe(
	'a paginated list (id_cursor)',
	defineListPaginationAcceptanceSpecs({
		model: 'id_cursor',
		list: listFor({ model: 'id_cursor', itemsKey: 'components' }, [['a'], ['b'], ['c']]),
	}),
)

describe(
	'an unpaginated list',
	defineListPaginationAcceptanceSpecs({
		model: 'none',
		list: listFor({ model: 'none', itemsKey: 'comments' }, [['a', 'b', 'c']]),
	}),
)

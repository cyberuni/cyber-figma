import { describe, expectTypeOf, it } from 'vitest'
import type { GetFileNodesResponse, GetFileResponse, GetImagesResponse } from './figma-types.js'

// The published spec is a beta artifact with verified defects. These are type
// assertions, not runtime checks: they fail the typecheck if a spec upgrade
// silently re-breaks a correction, or drops a type domain pods depend on.
describe('figma-types', () => {
	it('passes undefected spec types straight through', () => {
		expectTypeOf<GetFileResponse['name']>().toEqualTypeOf<string>()
	})

	// rest-api-spec#81: the prose docs document `err` on this response; the spec
	// omits it, so a spec-typed client discards a field the API returns.
	it('restores the err field the spec omits from GetFileNodesResponse', () => {
		expectTypeOf<GetFileNodesResponse['err']>().toEqualTypeOf<string | null | undefined>()
	})

	// The spec types `err` as always-null. On a 400 it carries the diagnostic
	// naming the invalid parameter — the most useful error detail Figma gives.
	it('widens the always-null err on GetImagesResponse to a real diagnostic', () => {
		expectTypeOf<GetImagesResponse['err']>().toEqualTypeOf<string | null>()
	})

	// Every requested node id appears as a key; a null value means that node
	// failed to render, not that the request failed.
	it('keeps per-node render failures expressible on GetImagesResponse', () => {
		expectTypeOf<GetImagesResponse['images'][string]>().toEqualTypeOf<string | null>()
	})
})

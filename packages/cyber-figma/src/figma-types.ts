import type {
	GetFileNodesResponse as SpecGetFileNodesResponse,
	GetImagesResponse as SpecGetImagesResponse,
} from '@figma/rest-api-spec'

// Figma's own typings package, re-exported as the response types for every
// domain — but not code-generated into a client. Figma labels the spec a beta
// artifact and it has verified defects; the corrections below are the ones
// documented in docs/research/figma-rest-api.md → "Known spec defects".
//
// An explicit export here shadows the same name from the star export, so
// importing from this module always gets the corrected shape.
export type * from '@figma/rest-api-spec'

/**
 * The prose docs document `err` on this response and the spec omits it
 * ([rest-api-spec#81](https://github.com/figma/rest-api-spec/issues/81)), so a
 * spec-typed client throws away a field the API actually returns.
 */
export type GetFileNodesResponse = SpecGetFileNodesResponse & {
	err?: string | null
}

/**
 * The spec types `err` as always-`null`. The prose docs contradict it: on a
 * `400` this field names which parameter was invalid. Widened to `string | null`
 * so the diagnostic survives into the error path.
 */
export type GetImagesResponse = Omit<SpecGetImagesResponse, 'err'> & {
	err: string | null
}

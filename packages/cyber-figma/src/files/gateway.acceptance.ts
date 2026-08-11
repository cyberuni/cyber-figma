import { expect, it } from 'vitest'
import type { FileGateway } from './gateway.js'

// The contract the Files gateway owes, whether it is talking to a double or to
// Figma. The specs that matter most here are the ones that encode Figma's
// surprises: a `null` render is a node-level outcome rather than a failed call,
// and every requested id comes back as a key regardless.

export type FileGatewayAcceptanceDeps = {
	gateway: FileGateway
	/** A file the credential can read. */
	fileKey: string
	/** A node id that exists in that file. */
	nodeId: string
	/**
	 * A well-formed node id that cannot render — nonexistent is fine. Figma
	 * answers `200` with `null` for it rather than failing the request.
	 */
	unrenderableNodeId: string
}

export function defineFileGatewayAcceptanceSpecs(deps: FileGatewayAcceptanceDeps) {
	return () => {
		it('returns the document and the metadata identifying its version', async () => {
			const file = await deps.gateway.get(deps.fileKey, { depth: 1 })

			expect(typeof file.name).toBe('string')
			expect(typeof file.version).toBe('string')
			expect(file.document).toBeTruthy()
		})

		it('returns an entry for each requested node', async () => {
			const response = await deps.gateway.getNodes(deps.fileKey, [deps.nodeId])

			expect(Object.keys(response.nodes)).toContain(deps.nodeId)
		})

		it('answers a render with a key for every requested id', async () => {
			const ids = [deps.nodeId, deps.unrenderableNodeId]
			const response = await deps.gateway.renderImages(deps.fileKey, ids, { format: 'png' })

			expect(Object.keys(response.images).sort()).toEqual([...ids].sort())
		})

		it('reports an unrenderable node as null rather than as a failed call', async () => {
			const response = await deps.gateway.renderImages(deps.fileKey, [deps.unrenderableNodeId], { format: 'png' })

			expect(response.images[deps.unrenderableNodeId]).toBeNull()
		})

		it('returns the image fills map already out of its meta envelope', async () => {
			const fills = await deps.gateway.getImageFills(deps.fileKey)

			expect(typeof fills.images).toBe('object')
		})

		it('returns file metadata without fetching the document', async () => {
			const meta = await deps.gateway.getMeta(deps.fileKey)

			expect(typeof meta.file.name).toBe('string')
			expect(typeof meta.file.last_touched_at).toBe('string')
		})
	}
}

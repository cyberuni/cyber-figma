import { expect, it } from 'vitest'
import { packageName } from './index.js'

it('exposes the package name', () => {
	expect(packageName).toBe('cyber-figma')
})

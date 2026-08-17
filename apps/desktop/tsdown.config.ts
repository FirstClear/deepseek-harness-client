import { defineConfig } from 'tsdown'

/**
 * The desktop shell ships `lib/main.js` as Electron's `main`. The root tsdown
 * default entry is `lib/types/index.js`, which this app does not emit.
 */
export default defineConfig({
  entry: ['lib/types/main.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: { neverBundle: ['electron'] },
})

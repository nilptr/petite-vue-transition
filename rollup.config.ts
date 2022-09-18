import type { RollupOptions } from 'rollup';

import typescript from '@rollup/plugin-typescript';

const config: RollupOptions = {
  input: 'src/index.ts',
  output: {
    // dir: 'dist/',
    file: 'dist/petite-vue-transition.js',
    format: 'umd',
    sourcemap: true,
    name: 'PetiteVueTransition',
    exports: 'default',
  },
  plugins: [typescript()],
};

export default config;

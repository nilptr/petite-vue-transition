import type { RollupOptions } from 'rollup';

import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const config: RollupOptions = {
  input: 'src/index.ts',
  output: [{
    // dir: 'dist/',
    file: 'dist/petite-vue-transition.js',
    format: 'umd',
    sourcemap: true,
    name: 'PetiteVueTransition',
    exports: 'default',
  }, {
    file: 'dist/petite-vue-transition.min.js',
    format: 'umd',
    sourcemap: true,
    name: 'PetiteVueTransition',
    exports: 'default',
    plugins: [terser()],
  }],
  plugins: [typescript()],
};

export default config;

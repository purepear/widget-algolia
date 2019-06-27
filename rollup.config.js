import resolve from 'rollup-plugin-node-resolve'
import vue from 'rollup-plugin-vue'
import commonjs from 'rollup-plugin-commonjs'
import uglify from 'rollup-plugin-uglify'
import babel from 'rollup-plugin-babel'

export default {
  input: 'src/algolia.vue',
  output: [
    {
      file: 'dist/widget-algolia.es.js',
      format: 'es',
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    vue(),
    babel(),
    uglify({
      mangle: false,
      keep_fnames: true,
    }),
  ],
  external: [
    '@mutt/widgets-vue',
    '@mutt/forms',
    'vue',
    'string-format',
    'algoliasearch',
  ],
}

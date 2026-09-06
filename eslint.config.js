import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'

/* Pragmatic lint gate: correctness + hook rules + the foot-guns that have
   actually bitten this codebase (unused vars, stray commas are parse errors
   anyway, console left in shipped code). Style is left to the house CSS/JSX
   conventions — this gate exists to catch defects, not to reformat. */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'qa/shots/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'test/**/*.{js,jsx}', 'qa/**/*.mjs'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
        clearInterval: 'readonly', requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly', fetch: 'readonly', URL: 'readonly',
        CustomEvent: 'readonly', Event: 'readonly', IntersectionObserver: 'readonly',
        matchMedia: 'readonly', performance: 'readonly', location: 'readonly',
        history: 'readonly', HTMLElement: 'readonly', Node: 'readonly',
        Image: 'readonly', MutationObserver: 'readonly', ResizeObserver: 'readonly',
        WebGLRenderingContext: 'readonly', WebGL2RenderingContext: 'readonly',
        Notification: 'readonly', Blob: 'readonly', FileReader: 'readonly',
        crypto: 'readonly', structuredClone: 'readonly', queueMicrotask: 'readonly',
        process: 'readonly', Buffer: 'readonly', require: 'readonly', module: 'readonly',
        IntersectionObserverEntry: 'readonly', DOMRect: 'readonly', getComputedStyle: 'readonly',
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'off', // globals above + browser/env mix; vitest/jsdom provide the rest
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
  {
    files: ['qa/**/*.mjs', 'test/**/*.{js,jsx}'],
    rules: { 'no-console': 'off' },
  },
]

// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import nextPlugin from '@next/eslint-plugin-next'
import tsParser from '@typescript-eslint/parser'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default [{
  ignores: ['.next/**', 'node_modules/**', 'e2e-output/**', 'test-results/**', 'coverage/**', 'storybook-static/**'],
}, {
  plugins: {
    '@next/next': nextPlugin,
    'react-hooks': reactHooksPlugin,
  },
  files: ['**/*.{js,ts,tsx}'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  rules: {
    ...nextPlugin.configs['core-web-vitals'].rules,
    ...reactHooksPlugin.configs.recommended.rules,
    '@next/next/no-html-link-for-pages': 'error',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/refs': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}, // Allow console.log in tests, scripts, and stories
{
  files: [
    'e2e/**/*.{js,ts}',
    'scripts/**/*.{js,ts}',
    '*.spec.ts', // Root-level spec files
    '**/__stories__/**/*.{js,ts,tsx}',
  ],
  rules: {
    'no-console': 'off',
  },
}, ...storybook.configs["flat/recommended"]];

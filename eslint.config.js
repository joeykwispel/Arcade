import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { projectService: true, extraFileExtensions: ['.svelte'], parser: ts.parser, svelteConfig } }
  },
  {
    rules: {
      // Internal links are built with app.href()/localize(), which already prefix the base path
      'svelte/no-navigation-without-resolve': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  // Each game has its own tooling and lints itself; the kit's header script is a verbatim copy.
  { ignores: ['dist/', '.svelte-kit/', 'node_modules/', 'test-results/', 'playwright-report/', '.playwright-mcp/', 'games/'] }
);

import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import eslintConfigPrettier from 'eslint-config-prettier';
import svelteConfig from './apps/airport/web/svelte.config.js';

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.turbo/**', 'build/**', 'dist/**', 'out/**', 'coverage/**', 'deprecated/**'],
  },
  ...svelte.configs.recommended,
  {
    files: ['apps/airport/web/src/**/*.svelte'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: tseslint.parser,
        svelteConfig,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  eslintConfigPrettier
);

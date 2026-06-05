import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: ['dist', 'dev-dist', 'node_modules', '**/*.js', '**/*.d.ts', 'supabase/functions/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Le projet utilise volontairement `any` à certains endroits (typage Supabase) :
      // on signale en warning plutôt qu'erreur pour ne pas bloquer le lint.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      // TypeScript gère lui-même les références non définies (types React.*, __dirname, etc.) :
      // `no-undef` ferait des faux positifs sur les fichiers TS.
      'no-undef': 'off',
      // `catch {}` volontairement vide (ex. localStorage en navigation privée).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];

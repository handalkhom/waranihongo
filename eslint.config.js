import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const everywhereBannedPaths = [
  { name: 'react-router-dom', message: 'Import from "react-router" (RouterProvider from "react-router/dom").' },
  { name: '@wara/web', message: 'Nothing imports @wara/web.' },
];

const everywhereBannedPatterns = [
  { group: ['@wara/web/*'], message: 'Nothing imports @wara/web.' },
];

const clockBan = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: '@wara/core is clock-free: take `now: Date` as a parameter.',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: '@wara/core is clock-free: take `now: Date` as a parameter.',
  },
  {
    selector: "CallExpression[callee.name='Date']",
    message: '@wara/core is clock-free: take `now: Date` as a parameter.',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: '@wara/core is deterministic: take `rng: () => number` as a parameter.',
  },
];

export default defineConfig([
  globalIgnores(['**/dist/**', '**/node_modules/**', '**/coverage/**']),
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-check': true, 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-restricted-imports': [
        'error',
        { paths: everywhereBannedPaths, patterns: everywhereBannedPatterns },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    extends: [reactRefresh.configs.vite],
  },
  {
    files: ['packages/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: everywhereBannedPaths,
          patterns: [
            ...everywhereBannedPatterns,
            { group: ['@wara/*'], message: '@wara/content is the base package; it imports no other @wara package.' },
            {
              regex: '^(\\.\\./)+(apps|packages|core|web)(/|$)',
              message: 'Do not reach outside the package through a relative path.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...everywhereBannedPaths,
            { name: '@wara/content', message: '@wara/core imports only types from "@wara/content/schema"; data arrives as arguments.' },
            { name: 'react', message: '@wara/core does not import React.' },
            { name: 'react-dom', message: '@wara/core does not import React or the DOM.' },
            { name: 'dexie', message: '@wara/core does not import Dexie; use the Repository interface.' },
            { name: 'dexie-react-hooks', message: '@wara/core does not import Dexie or React.' },
          ],
          patterns: [
            ...everywhereBannedPatterns,
            {
              group: ['@wara/content/*', '!@wara/content/schema'],
              message: '@wara/core imports only from "@wara/content/schema".',
            },
            { group: ['react/*', 'react-dom/*', 'dexie/*'], message: '@wara/core does not import React, the DOM, or Dexie.' },
            {
              regex: '^(\\.\\./)+(apps|packages|content|web)(/|$)',
              message: 'Do not reach outside the package through a relative path.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...clockBan],
    },
  },
]);

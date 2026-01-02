import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default defineConfig(
	eslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	svelte.configs.recommended,
	{
		languageOptions: {
			globals: globals.browser,
			parserOptions: {
				projectService: true,
			},
		},
	},
	{
		plugins: {
			'unused-imports': unusedImports,
		},
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_',
				},
			],
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		extends: [tseslint.configs.disableTypeChecked],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},
);
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import tsParser from '@typescript-eslint/parser';
import cspellESLintPluginRecommended from '@cspell/eslint-plugin/recommended';
import jsdoc from 'eslint-plugin-jsdoc';

export default tseslint.config(
	eslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	importPlugin.flatConfigs.recommended,
	importPlugin.flatConfigs.typescript,
	sonarjs.configs.recommended,
	cspellESLintPluginRecommended,
	jsdoc.configs['flat/recommended-typescript'],
	prettierRecommended,
	{
		ignores: [
			'**/dist',
			'**/node_modules',
			'**/.github',
			'**/.nyc_output',
			'**/vite.config.mts',
			'coverage',
			'reports',
			'eslint.config.mjs',
			'test/testImport.mjs',
			'test/testRequire.cjs',
		],
	},
	{
		plugins: {
			'@stylistic/ts': stylistic,
		},
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'module',
			parserOptions: {
				project: './tsconfig.test.json',
			},
		},
		settings: {
			'import/resolver': {
				typescript: {
					extensions: ['.ts', '.mts'],
					moduleDirectory: ['node_modules', 'src/'],
				},
			},
		},
		rules: {
			'sort-imports': 'off',
			'import/order': [
				'warn',
				{
					groups: ['builtin', 'external', 'parent', 'sibling', 'index'],
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
					named: true,
					'newlines-between': 'never',
				},
			],
			'import/no-useless-path-segments': 'warn',
			'import/no-duplicates': 'error',
			curly: 'error',
			camelcase: 'off',
			'@typescript-eslint/no-this-alias': [
				'warn',
				{
					allowedNames: ['self'],
				},
			],
			'sort-keys': [
				'warn',
				'asc',
				{
					caseSensitive: false,
					natural: true,
					minKeys: 10,
				},
			],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/no-deprecated': 'warn',
			'lines-between-class-members': 'off',
			'@stylistic/ts/lines-between-class-members': [
				'warn',
				'always',
				{
					exceptAfterOverload: true,
					exceptAfterSingleLine: true,
				},
			],
			'@typescript-eslint/consistent-type-imports': ['warn', {prefer: 'type-imports', fixStyle: 'inline-type-imports'}],
			'@typescript-eslint/member-ordering': [
				'warn',
				{
					classes: [
						'public-abstract-field',
						'protected-abstract-field',
						'static-field',
						'static-method',
						'field',
						'constructor',
						'public-method',
						'protected-method',
						'private-method',
						'#private-method',
						'public-abstract-method',
						'protected-abstract-method',
					],
				},
			],
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					selector: ['variable', 'parameter'],
					modifiers: ['destructured'],
					format: null,
				},
				{
					selector: 'variable',
					modifiers: ['const'],
					format: ['camelCase', 'PascalCase'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'variableLike',
					format: ['camelCase', 'PascalCase'],
					leadingUnderscore: 'allow',
					filter: {
						// you can expand with "|" this regex to add more allowed names
						regex: '^(__DEV__)$',
						match: false,
					},
				},
				{
					selector: 'typeAlias',
					format: ['PascalCase'],
				},
				{
					selector: 'interface',
					prefix: ['I'],
					format: ['PascalCase'],
				},
			],
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'warn',
			'@typescript-eslint/prefer-optional-chain': 'warn',
			'sonarjs/no-commented-code': 'warn', // to keep codebase clean
			'sonarjs/deprecation': 'warn', // to keep codebase clean
			'sonarjs/deprecation': 'off',
			'@typescript-eslint/no-deprecated': 'off',
			'jsdoc/no-types': 'off',
			'jsdoc/require-param-type': 'warn',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
		},
	},
	{
		files: ['./test/**/*.mts'],
		rules: {
			'@cspell/spellchecker': 'off',
			'jsdoc/require-jsdoc': 'off',
			'sonarjs/no-commented-code': 'off',
			'jsdoc/require-param': 'off',
			'jsdoc/require-returns': 'off',
		},
	},
);

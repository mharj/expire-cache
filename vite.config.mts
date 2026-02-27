/// <reference types="vitest" />

import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			include: ['src/**/*.mts'],
			provider: 'v8',
			reporter: ['text', 'lcov'],
		},
		include: ['test/**/*.test.mts', 'test/**/*.cjs', 'test/**/*.mjs'],
		outputFile: {
			junit: './reports/jest-results.xml',
		},
		reporters: process.env.GITHUB_ACTIONS ? ['github-actions', 'junit'] : ['verbose', 'github-actions', 'junit'],
	},
});

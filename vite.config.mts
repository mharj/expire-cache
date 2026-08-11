/// <reference types="vitest" />

import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			include: ['src/**/*.mts'],
			provider: 'v8',
			reporter: ['text', 'lcovonly'],
		},
		include: ['test/**/*.test.mts', 'test/**/*.cjs', 'test/**/*.mjs'],
		reporters: ['minimal', 'github-actions'],
	},
});

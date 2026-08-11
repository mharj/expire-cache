import {describe, expect, it} from 'vitest';
const {ExpireCache, ExpireTimeoutCache} = require('../dist/index.cjs');

describe('CJS require loading', function () {
	it('should have the ExpireCache class', function () {
		expect(ExpireCache).to.be.an('function');
	});

	it('should have the ExpireTimeoutCache class', function () {
		expect(ExpireTimeoutCache).to.be.an('function');
	});
});

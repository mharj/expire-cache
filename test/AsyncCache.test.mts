import type {IAsyncCache} from '@luolapeikko/cache-types';
import {beforeAll, describe, expect, it} from 'vitest';
import {iterAsArray} from './lib/iter.mjs';
import {TestAsync} from './mockup/TestAsync.mjs';

let cache: IAsyncCache<string>;

describe('TestAsync cache', () => {
	beforeAll(function () {
		cache = new TestAsync<string>();
	});
	it('should return undefined value if not cached yet', async function () {
		await expect(cache.get('key')).resolves.toEqual(undefined);
	});
	it('should return cached value', async function () {
		await cache.set('key', 'value');
		await expect(cache.get('key')).resolves.toEqual('value');
		expect(Array.from(await iterAsArray(cache.entries()))).to.be.eql([['key', 'value']]);
		expect(Array.from(await iterAsArray(cache.keys()))).to.be.eql(['key']);
		expect(Array.from(await iterAsArray(cache.values()))).to.be.eql(['value']);
	});
	it('should check that key exists', async function () {
		await expect(cache.has('key')).resolves.toEqual(true);
	});
	it('should check cache size', async function () {
		await expect(cache.size()).resolves.toEqual(1);
	});
	it('should return undefined value if expired', async function () {
		await cache.set('key', 'value', new Date(Date.now() + 1)); // expires in 1ms
		await new Promise((resolve) => setTimeout(resolve, 10));
		await expect(cache.get('key')).resolves.toEqual(undefined);
	});
	it('should return undefined value if deleted', async function () {
		await cache.set('key', 'value');
		await cache.delete('key');
		await expect(cache.get('key')).resolves.toEqual(undefined);
	});
	it('should return undefined value if cleared', async function () {
		await cache.set('key', 'value');
		await cache.clear();
		await expect(cache.get('key')).resolves.toEqual(undefined);
	});
});

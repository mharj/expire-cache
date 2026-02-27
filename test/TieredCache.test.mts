import {type ILoggerLike, LogLevel} from '@avanio/logger-like';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TieredCacheLogMapType} from '../src/index.mjs';
import {DateTieredCache, DateTimeout} from './mockup/DateTieredCache.mjs';

const traceSpy = vi.fn();
const infoSpy = vi.fn();
const warnSpy = vi.fn();
const errorSpy = vi.fn();
const debugSpy = vi.fn();

const statusUpdateSpy = vi.fn();

const spyLogger: ILoggerLike = {
	debug: debugSpy,
	error: errorSpy,
	info: infoSpy,
	trace: traceSpy,
	warn: warnSpy,
};

const logLevelMap: TieredCacheLogMapType = {
	clear: LogLevel.Trace,
	clearTimeoutKey: LogLevel.Trace,
	constructor: LogLevel.Trace,
	delete: LogLevel.Trace,
	get: LogLevel.None,
	has: LogLevel.Trace,
	runTimeout: LogLevel.Trace,
	set: LogLevel.None,
	setTimeout: LogLevel.Trace,
	size: LogLevel.Trace,
};

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

let cache: DateTieredCache;

describe('TieredCache cache', () => {
	beforeEach(function () {
		cache = new DateTieredCache(spyLogger, logLevelMap);
		cache.on('update', statusUpdateSpy);
		traceSpy.mockReset();
		infoSpy.mockReset();
		warnSpy.mockReset();
		errorSpy.mockReset();
		debugSpy.mockReset();
		statusUpdateSpy.mockReset();
	});
	it('should return undefined value if not cached yet', async function () {
		await expect(cache.get('key', 'model')).resolves.toEqual(undefined);
		expect(statusUpdateSpy.mock.calls.length).toEqual(0);
	});
	it('should return cached value', async function () {
		const date = new Date();
		await cache.set('key', 'model', date);
		expect(traceSpy.mock.calls.length).toEqual(1);
		await expect(cache.get('key', 'stringValue')).resolves.toEqual(`{"$cdate":${date.getTime().toString()}}`);
		await expect(cache.get('key', 'object')).resolves.toEqual({$cdate: date.getTime()});
		await expect(cache.get('key', 'model')).resolves.toEqual(date);
		expect(traceSpy.mock.calls.length).toEqual(4);
		expect(statusUpdateSpy.mock.calls.length).toEqual(1);
		expect(cache.deleteKeys(['key'])).toEqual(1);
	});
	it('should return cached value and wait timeouts', async function () {
		const date = new Date();
		await cache.set('key', 'model', date);
		expect(traceSpy.mock.calls.length).toEqual(1);
		await expect(cache.get('key', 'model')).resolves.toEqual(date);
		expect(cache.getTier('key')).toEqual('model');
		expect(cache.status()).toEqual({size: 1, tiers: {model: 1, object: 0, stringValue: 0}});
		traceSpy.mockReset();
		await sleep(DateTimeout.Model);
		expect(cache.getTier('key')).toEqual('object');
		expect(cache.status()).toEqual({size: 1, tiers: {model: 0, object: 1, stringValue: 0}});
		expect(traceSpy.mock.calls.length).toEqual(3);
		traceSpy.mockReset();
		await sleep(DateTimeout.Object);
		expect(cache.getTier('key')).toEqual('stringValue');
		expect(cache.status()).toEqual({size: 1, tiers: {model: 0, object: 0, stringValue: 1}});
		expect(traceSpy.mock.calls.length).toEqual(3);
		await expect(cache.get('key', 'stringValue')).resolves.toEqual(date.getTime().toString());
		// should clear cache entry
		traceSpy.mockReset();
		await sleep(DateTimeout.StringValue);
		expect(cache.getTier('key')).toEqual(undefined);
		expect(cache.status()).toEqual({size: 0, tiers: {model: 0, object: 0, stringValue: 0}});
		expect(traceSpy.mock.calls.length).toEqual(2);
		traceSpy.mockReset();
		expect(statusUpdateSpy.mock.calls.length).toEqual(4); // insert, timeout, timeout, timeout
	});
	it('should test iterators', async function () {
		const date = new Date();
		await cache.setEntries('model', [['key', date]]);
		for await (const entry of cache.tierValues('model')) {
			expect(entry).toEqual(date);
		}
		for await (const [key, value] of cache.tierEntries('model')) {
			expect(key).toEqual('key');
			expect(value).toEqual(date);
		}
		const keys = [...cache.keys()];
		expect(keys).toEqual(['key']);
		expect(cache.size()).toEqual(1);
		expect(cache.has('key')).toEqual(true);
		expect(cache.delete('key')).toEqual(true);
		expect(cache.size()).toEqual(0);
		await cache.set('key', 'model', date);
		expect(cache.clear()).toEqual(undefined);
	});
	afterEach(function () {
		cache.clear();
	});
});

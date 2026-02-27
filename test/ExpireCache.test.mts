import {type ILoggerLike, LogLevel} from '@avanio/logger-like';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ExpireCache, type ExpireCacheLogMapType} from '../src/index.mjs';
import {iterAsArray} from './lib/iter.mjs';

const onExpiresSpy = vi.fn();

const traceSpy = vi.fn();
const infoSpy = vi.fn();
const warnSpy = vi.fn();
const errorSpy = vi.fn();
const debugSpy = vi.fn();

const spyLogger: ILoggerLike = {
	debug: debugSpy,
	error: errorSpy,
	info: infoSpy,
	trace: traceSpy,
	warn: warnSpy,
};

const logLevelMap: ExpireCacheLogMapType = {
	cleanExpired: LogLevel.Trace,
	clear: LogLevel.Trace,
	constructor: LogLevel.Trace,
	delete: LogLevel.Trace,
	expires: LogLevel.Trace,
	get: LogLevel.Trace,
	has: LogLevel.Trace,
	onExpire: LogLevel.None,
	set: LogLevel.Trace,
	size: LogLevel.Trace,
};

let cache: ExpireCache<string>;

describe('Expire Cache', function () {
	beforeEach(function () {
		traceSpy.mockReset();
		infoSpy.mockReset();
		warnSpy.mockReset();
		errorSpy.mockReset();
		debugSpy.mockReset();
		onExpiresSpy.mockReset();
		cache = new ExpireCache<string>(spyLogger, logLevelMap);
		cache.on('expires', onExpiresSpy);
		cache.setExpireMs(undefined);
	});
	it('should return undefined value if not cached yet', function () {
		expect(cache.get('key')).to.be.eq(undefined);
		expect(cache.size()).to.be.equal(0);
		expect(traceSpy.mock.calls.length).to.be.equal(3);
		expect(traceSpy.mock.calls[0][0]).to.be.equal('ExpireCache created, defaultExpireMs: undefined');
		expect(traceSpy.mock.calls[1][0]).to.be.equal('ExpireCache get key: key');
		expect(traceSpy.mock.calls[2][0]).to.be.equal('ExpireCache size: 0');
	});
	it('should return cached value', async function () {
		cache.set('key', 'value');
		expect(cache.size()).to.be.equal(1);
		expect(cache.get('key')).to.equal('value');
		expect(cache.has('key')).to.equal(true);
		expect(traceSpy.mock.calls.length).to.be.equal(5);
		expect(traceSpy.mock.calls[0][0]).to.be.equal('ExpireCache created, defaultExpireMs: undefined');
		expect(traceSpy.mock.calls[1][0]).to.be.equal('ExpireCache set key: key, expireTs: undefined');
		expect(traceSpy.mock.calls[2][0]).to.be.equal('ExpireCache size: 1');
		expect(traceSpy.mock.calls[3][0]).to.be.equal('ExpireCache get key: key');
		expect(traceSpy.mock.calls[4][0]).to.be.equal('ExpireCache has key: key');
		expect(await iterAsArray(cache.entries())).to.be.eql([['key', 'value']]);
		expect(await iterAsArray(cache.keys())).to.be.eql(['key']);
		expect(await iterAsArray(cache.values())).to.be.eql(['value']);
	});
	it('should return cached value', function () {
		const expires = new Date(Date.now() + 1000);
		cache.set('key', 'value', expires);
		expect(cache.expires('key')?.getTime()).to.be.equal(expires.getTime());
		expect(traceSpy.mock.calls[0][0]).to.be.equal('ExpireCache created, defaultExpireMs: undefined');
		expect(traceSpy.mock.calls[1][0]).to.be.equal(`ExpireCache set key: key, expireTs: ${expires.getTime().toString()}`);
		expect(traceSpy.mock.calls[2][0]).to.be.equal('ExpireCache get expire for key: key');
	});
	it('should return undefined value if expired', async function () {
		cache.set('key', 'value', new Date(Date.now() + 1)); // epires in 1ms
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(cache.size()).to.be.equal(1);
		expect(cache.get('key')).to.be.eq(undefined);
		expect(cache.size()).to.be.equal(0);
		expect(traceSpy.mock.calls.length).to.be.equal(6);
		expect(traceSpy.mock.calls[0][0]).to.be.equal('ExpireCache created, defaultExpireMs: undefined');
		expect(traceSpy.mock.calls[1][0]).to.match(/^ExpireCache set key: key, expireTs: \d+$/);
		expect(traceSpy.mock.calls[2][0]).to.be.equal('ExpireCache size: 1');
		expect(traceSpy.mock.calls[3][0]).to.be.equal('ExpireCache get key: key');
		expect(traceSpy.mock.calls[4][0]).to.be.equal('ExpireCache expired count: 1');
		expect(traceSpy.mock.calls[5][0]).to.be.equal('ExpireCache size: 0');
		expect(onExpiresSpy.mock.calls.length).to.be.equal(1);
		expect(onExpiresSpy.mock.calls[0].slice(0, 2)).to.be.eql(['key', 'value']); // onExpire called
	});
	it('should return undefined value if deleted', function () {
		cache.set('key', 'value');
		cache.delete('key');
		expect(traceSpy.mock.calls.length).to.be.equal(3);
		expect(traceSpy.mock.calls[0][0]).to.be.equal('ExpireCache created, defaultExpireMs: undefined');
		expect(traceSpy.mock.calls[1][0]).to.be.equal('ExpireCache set key: key, expireTs: undefined');
		expect(traceSpy.mock.calls[2][0]).to.be.equal('ExpireCache delete key: key');
		expect(cache.get('key')).to.be.eq(undefined);
	});
	it('should return undefined value if cleared', function () {
		cache.set('key', 'value');
		cache.clear();
		expect(traceSpy.mock.calls.length).to.be.equal(3);
		expect(traceSpy.mock.calls[0][0]).to.be.equal('ExpireCache created, defaultExpireMs: undefined');
		expect(traceSpy.mock.calls[1][0]).to.be.equal('ExpireCache set key: key, expireTs: undefined');
		expect(traceSpy.mock.calls[2][0]).to.be.equal('ExpireCache clear');
		expect(cache.get('key')).to.be.eq(undefined);
	});
	it('should have default expiration time', async function () {
		cache = new ExpireCache<string>(spyLogger, undefined, 100);
		cache.set('key', 'value');
		expect(cache.get('key')).to.equal('value');
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(cache.get('key')).to.be.eq(undefined);
	});
});

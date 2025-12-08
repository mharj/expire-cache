import {EventEmitter} from 'events';
import {type ILoggerLike, LogLevel, type LogMapInfer, MapLogger} from '@avanio/logger-like';
import {type CacheEventsMap, type ICacheWithEvents} from '@luolapeikko/cache-types';
import {type ExpireCacheLogMapType} from './ExpireCache.mjs';

/**
 * The default log mapping for the ExpireCache class.
 * This maps each method to a log level, allowing you to control the logging output.
 * By default, all logs are disabled (None level)
 * @example
 * const cache = new ExpireCache<string>(console, {
 *   get: LogLevel.Info,
 *   set: LogLevel.Debug,
 *   delete: LogLevel.Warn,
 * });
 */
const defaultLogMap = {
	cleanExpired: LogLevel.None,
	clear: LogLevel.None,
	constructor: LogLevel.None,
	delete: LogLevel.None,
	expires: LogLevel.None,
	get: LogLevel.None,
	has: LogLevel.None,
	onExpire: LogLevel.None,
	set: LogLevel.None,
	size: LogLevel.None,
} satisfies ExpireCacheLogMapType;

export type ExpireTimeoutCacheLogMapType = LogMapInfer<typeof defaultLogMap>;

type TimeoutObjectType = {timeout: ReturnType<typeof setTimeout> | undefined; expires: Date | undefined};

/**
 * ExpireCache class that implements the ICache interface with value expiration and expires with setTimeout
 * @template Payload - The type of the cached data
 * @template Key - (optional) The type of the cache key (default is string)
 * @since v0.6.5
 */
export class ExpireTimeoutCache<Payload, Key = string> extends EventEmitter<CacheEventsMap<Payload, Key>> implements ICacheWithEvents<Payload, Key> {
	private readonly cache = new Map<Key, Payload>();
	private readonly cacheTimeout = new Map<Key, TimeoutObjectType>();
	public readonly logger: MapLogger<ExpireTimeoutCacheLogMapType>;
	private defaultExpireMs: undefined | number;
	/**
	 * Creates a new instance of the ExpireTimeoutCache class
	 * @param {ILoggerLike} logger - The logger to use (optional)
	 * @param {Partial<ExpireTimeoutCacheLogMapType>} logMapping - The log mapping to use (optional). Default is all logging disabled
	 * @param {number} defaultExpireMs - The default expiration time in milliseconds (optional)
	 */
	constructor(logger?: ILoggerLike, logMapping?: Partial<ExpireTimeoutCacheLogMapType>, defaultExpireMs?: number) {
		super();
		this.logger = new MapLogger<ExpireTimeoutCacheLogMapType>(logger, Object.assign({}, defaultLogMap, logMapping));
		this.logger.logKey('constructor', `ExpireTimeoutCache created, defaultExpireMs: ${String(defaultExpireMs)}`);
		this.defaultExpireMs = defaultExpireMs;
	}

	public set(key: Key, data: Payload, expires?: Date) {
		this.clearTimeout(key);
		const {expiresInMs, ...options} = this.handleTimeoutSetup(key, this.getExpireDate(expires));
		const expireString = expiresInMs ? `${expiresInMs.toString()} ms` : 'undefined';
		this.logger.logKey('set', `ExpireTimeoutCache set key: ${String(key)}, expireTs: ${expireString}`);
		this.cache.set(key, data);
		this.cacheTimeout.set(key, options);
	}

	public get(key: Key) {
		this.logger.logKey('get', `ExpireTimeoutCache get key: ${String(key)}`);
		this.emit('get', key);
		return this.cache.get(key);
	}

	public has(key: Key) {
		this.logger.logKey('has', `ExpireTimeoutCache has key: ${String(key)}`);
		return this.cache.has(key);
	}

	public expires(key: Key): Date | undefined {
		this.logger.logKey('expires', `ExpireTimeoutCache get expire for key: ${String(key)}`);
		return this.cacheTimeout.get(key)?.expires;
	}

	public delete(key: Key) {
		this.logger.logKey('delete', `ExpireTimeoutCache delete key: ${String(key)}`);
		this.clearTimeout(key);
		const entry = this.cache.get(key);
		if (entry) {
			this.emit('delete', key);
			this.notifyExpires(new Map<Key, Payload>([[key, entry]]));
		}
		return this.cache.delete(key);
	}

	public clear() {
		this.logger.logKey('clear', `ExpireTimeoutCache clear`);
		this.cacheTimeout.forEach((_value, key) => this.clearTimeout(key));
		const copy = new Map<Key, Payload>(this.cache);
		this.notifyExpires(copy);
		this.emit('clear', copy);
		this.cache.clear();
		this.cacheTimeout.clear();
	}

	public size() {
		this.logger.logKey('size', `ExpireTimeoutCache size: ${this.cache.size.toString()}`);
		return this.cache.size;
	}

	public entries(): IterableIterator<[Key, Payload]> {
		return new Map(this.cache).entries();
	}

	public keys(): IterableIterator<Key> {
		return new Map(this.cache).keys();
	}

	public values(): IterableIterator<Payload> {
		return new Map(this.cache).values();
	}

	/**
	 * Set the default expiration time in milliseconds
	 * @param {number} expireMs - The default expiration time in milliseconds
	 */
	public setExpireMs(expireMs: number | undefined) {
		this.defaultExpireMs = expireMs;
	}

	private clearTimeout(key: Key) {
		const entry = this.cacheTimeout.get(key);
		if (entry?.timeout) {
			clearTimeout(entry.timeout);
			entry.timeout = undefined;
		}
	}

	private notifyExpires(entries: Map<Key, Payload>) {
		for (const [key, value] of entries.entries()) {
			this.emit('expires', key, value);
		}
	}

	private getExpireDate(expires: Date | undefined): Date | undefined {
		const defaultExpireDate: Date | undefined = this.defaultExpireMs ? new Date(Date.now() + this.defaultExpireMs) : undefined;
		return expires ?? defaultExpireDate;
	}

	private handleExpiredCallback(key: Key) {
		this.logger.logKey('onExpire', `ExpireTimeoutCache onExpire key: ${String(key)}`);
		this.delete(key);
	}

	private handleTimeoutSetup(key: Key, expiresDate: Date | undefined): TimeoutObjectType & {expiresInMs: number | undefined} {
		const expiresInMs = expiresDate && expiresDate.getTime() - Date.now();
		const timeout = expiresInMs !== undefined ? setTimeout(() => this.handleExpiredCallback(key), expiresInMs) : undefined;
		return {expiresInMs, timeout, expires: expiresDate};
	}
}

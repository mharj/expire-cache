import type {CacheEventsMap, ICacheWithEvents} from '@luolapeikko/cache-types';
import {KeyLogger, type KeyLoggerMapInfer} from '@luolapeikko/key-logger';
import type {ILoggerLike} from '@luolapeikko/logger-type';
import type {LogLevelType} from '@luolapeikko/loglevel-type';
import {EventEmitter} from 'events';

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
	cleanExpired: 'none',
	clear: 'none',
	constructor: 'none',
	delete: 'none',
	expires: 'none',
	get: 'none',
	has: 'none',
	onExpire: 'none',
	set: 'none',
	size: 'none',
} as const satisfies Record<string, LogLevelType>;

export type ExpireCacheLogMapType = KeyLoggerMapInfer<typeof defaultLogMap>;

/**
 * ExpireCache class that implements the ICache interface with value expiration and expires on read operations
 * @template Payload - The type of the cached data
 * @template Key - (optional) The type of the cache key (default is string)
 * @since v0.6.5
 */
export class ExpireCache<Payload, Key = string> extends EventEmitter<CacheEventsMap<Payload, Key>> implements ICacheWithEvents<Payload, Key> {
	private readonly cache = new Map<Key, Payload>();
	private readonly cacheTtl = new Map<Key, number | undefined>();
	public readonly logger: KeyLogger<ExpireCacheLogMapType>;
	private defaultExpireMs: undefined | number;

	/**
	 * Creates a new instance of the ExpireCache class
	 * @param {ILoggerLike} logger - The logger to use (optional)
	 * @param {Partial<ExpireCacheLogMapType>} logMapping - The log mapping to use (optional). Default is all logging disabled
	 * @param {number} defaultExpireMs - The default expiration time in milliseconds (optional)
	 */
	public constructor(logger?: ILoggerLike, logMapping?: Partial<ExpireCacheLogMapType>, defaultExpireMs?: number) {
		super();
		this.logger = new KeyLogger<ExpireCacheLogMapType>(Object.assign({}, defaultLogMap, logMapping), logger);
		this.logger.key('constructor', `ExpireCache created, defaultExpireMs: ${String(defaultExpireMs)}`);
		this.defaultExpireMs = defaultExpireMs;
	}

	public set(key: Key, data: Payload, expires?: Date) {
		const expireTs: number | undefined = this.getExpireDate(expires)?.getTime();
		this.logger.key('set', `ExpireCache set key: ${String(key)}, expireTs: ${String(expireTs)}`);
		this.emit('set', key, data, this.getExpireDate(expires));
		this.cache.set(key, data);
		this.cacheTtl.set(key, expireTs);
	}

	public get(key: Key) {
		this.logger.key('get', `ExpireCache get key: ${String(key)}`);
		this.emit('get', key);
		this.cleanExpired();
		return this.cache.get(key);
	}

	public has(key: Key) {
		this.logger.key('has', `ExpireCache has key: ${String(key)}`);
		this.cleanExpired();
		return this.cache.has(key);
	}

	public expires(key: Key): Date | undefined {
		this.logger.key('expires', `ExpireCache get expire for key: ${String(key)}`);
		const expires = this.cacheTtl.get(key);
		this.cleanExpired();
		return expires ? new Date(expires) : undefined;
	}

	public delete(key: Key) {
		this.logger.key('delete', `ExpireCache delete key: ${String(key)}`);
		const entry = this.cache.get(key);
		if (entry) {
			this.notifyExpires(new Map<Key, Payload>([[key, entry]]));
			this.emit('delete', key);
		}
		this.cacheTtl.delete(key);
		return this.cache.delete(key);
	}

	public clear() {
		this.logger.key('clear', `ExpireCache clear`);
		const copy = new Map<Key, Payload>(this.cache);
		this.notifyExpires(copy);
		this.emit('clear', copy);
		this.cache.clear();
		this.cacheTtl.clear();
	}

	public size() {
		this.logger.key('size', `ExpireCache size: ${this.cache.size.toString()}`);
		return this.cache.size;
	}

	public entries(): IterableIterator<[Key, Payload]> {
		this.cleanExpired();
		return new Map(this.cache).entries();
	}

	public keys(): IterableIterator<Key> {
		this.cleanExpired();
		return new Map(this.cache).keys();
	}

	public values(): IterableIterator<Payload> {
		this.cleanExpired();
		return new Map(this.cache).values();
	}

	/**
	 * Sets the default expiration time in milliseconds
	 * @param {number} expireMs - The default expiration time in milliseconds
	 */
	public setExpireMs(expireMs: number | undefined) {
		this.defaultExpireMs = expireMs;
	}

	/**
	 * Cleans expired cache entries
	 */
	private cleanExpired() {
		const now = Date.now();
		const deleteEntries = new Map<Key, Payload>();
		for (const [key, expire] of this.cacheTtl.entries()) {
			if (expire !== undefined && expire < now) {
				const value = this.cache.get(key);
				if (value) {
					deleteEntries.set(key, value);
					this.cache.delete(key);
				}
				this.cacheTtl.delete(key);
			}
		}
		if (deleteEntries.size > 0) {
			this.notifyExpires(deleteEntries);
			this.logger.key('cleanExpired', `ExpireCache expired count: ${deleteEntries.size.toString()}`);
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
}

import {EventEmitter} from 'events';
import {type ILoggerLike, LogLevel, type LogMapInfer, MapLogger} from '@avanio/logger-like';
import {type ExpireCacheLogMapType} from './ExpireCache.mjs';

export type TierType<Data, Tier extends string> = {tier: Tier; data: Data};

/**
 * Helper type to build cache tier getter methods
 */
export type GetCacheTier<T extends TierType<unknown, string>[], Key> = {
	[K in T[number] as `get${Capitalize<K['tier']>}`]: (key: Key, cache: T[number]) => Promise<K['data'] | undefined> | K['data'] | undefined;
};

export type TierStatusRecord<T extends TierType<unknown, string>[]> = Record<T[number]['tier'], number>;

export type TierStatusInitialRecord<T extends TierType<unknown, string>[]> = Record<T[number]['tier'], 0>;

export type TieredCacheStatus<T extends TierType<unknown, string>[]> = {
	size: number;
	tiers: TierStatusRecord<T>;
};

type MultiTierCacheEvents<T extends TierType<unknown, string>[], Key> = {
	update: [status: Readonly<TieredCacheStatus<T>>];
	set: [Iterable<Key>];
	delete: [Iterable<Key>];
	clear: [];
};

const defaultLogMap = {
	clear: LogLevel.None,
	clearTimeoutKey: LogLevel.None,
	constructor: LogLevel.None,
	delete: LogLevel.None,
	get: LogLevel.None,
	has: LogLevel.None,
	runTimeout: LogLevel.None,
	set: LogLevel.None,
	setTimeout: LogLevel.None,
	size: LogLevel.None,
} as const;

export type TieredCacheLogMapType = LogMapInfer<typeof defaultLogMap>;

/**
 * Multi tier cache with timeout support to change tier based on timeout
 * @since v0.6.0
 */
export abstract class TieredCache<Tiers extends TierType<unknown, string>[], TimeoutEnum extends number, Key> extends EventEmitter<
	MultiTierCacheEvents<Tiers, Key>
> {
	public abstract readonly cacheName: string;
	protected readonly cache = new Map<Key, Tiers[number]>();
	private readonly cacheTimeout = new Map<Key, ReturnType<typeof setTimeout> | undefined>();
	public readonly logger: MapLogger<TieredCacheLogMapType>;
	private statusData: Readonly<TieredCacheStatus<Tiers>>;
	constructor(logger?: ILoggerLike, logMapping?: Partial<ExpireCacheLogMapType>) {
		super();
		this.logger = new MapLogger<TieredCacheLogMapType>(logger, Object.assign({}, defaultLogMap, logMapping));
		this.logCacheName();
		this.handleCacheEntry = this.handleCacheEntry.bind(this);
		this.statusData = {size: 0, tiers: {...this.getInitialStatusData()}};
	}

	/**
	 * Get cache entry from cache
	 * @param {Key} key - cache key
	 * @param {T['tier']} tier - cache tier
	 * @param {TimeoutEnum} [timeout] - optional update to new timeout for cache entry (if not provided, default timeout for tier will be used)
	 * @returns - promise that resolves when cache entry is set
	 */
	public async get<T extends Tiers[number]>(key: Key, tier: T['tier'], timeout?: TimeoutEnum): Promise<T['data'] | undefined> {
		this.logger.logKey('get', `MultiTierCache ${this.cacheName} get: '${String(key)}' tier: ${tier}`);
		const entry = this.cache.get(key);
		const value = await this.handleCacheEntry(key, tier, entry);
		// if we found entry, let's extend timeout
		if (value) {
			this.setTimeout(key, timeout ?? this.handleTierDefaultTimeout(tier));
		}
		return value;
	}

	/**
	 * Set cache entry
	 * @param {Key} key - cache key
	 * @param {T['tier']} tier - cache tier
	 * @param {T['data']} data - cache data
	 * @param {TimeoutEnum} [timeout] - optional timeout for cache entry. Else timeout will be checked from handleTimeoutValue or default timeout for tier.
	 */
	public async set<T extends Tiers[number]>(key: Key, tier: T['tier'], data: T['data'], timeout?: TimeoutEnum): Promise<void> {
		this.logger.logKey('set', `MultiTierCache ${this.cacheName} set: '${String(key)}' tier: ${tier}`);
		await this.handleSetValue(key, tier, data, timeout);
		this.emit('set', [key]);
		this.emit('update', this.buildStatus(true));
	}

	/**
	 * Set multiple cache entries
	 * @param {T['tier']} tier - cache tier
	 * @param {Iterable<[Key, T['data']]>} entries - iterable of key, data pairs
	 * @param {TimeoutEnum} [timeout] - optional timeout for cache entry. Else timeout will be checked from handleTimeoutValue or default timeout for tier.
	 */
	public async setEntries<T extends Tiers[number]>(tier: T['tier'], entries: Iterable<[Key, T['data']]>, timeout?: TimeoutEnum): Promise<void> {
		const entriesArray = Array.from(entries);
		this.logger.logKey('set', `MultiTierCache ${this.cacheName} setEntries (count: ${entriesArray.length.toString()}) tier: ${tier}`);
		for (const [key, data] of entriesArray) {
			await this.handleSetValue(key, tier, data, timeout);
		}
		this.emit(
			'set',
			entriesArray.map(([key]) => key),
		);
		this.emit('update', this.buildStatus(true));
	}

	/**
	 * Get tier type for current key
	 * @param {Key} key - cache key
	 * @returns {Tiers[number]['tier'] | undefined} The tier type or undefined if not found
	 */
	public getTier(key: Key): Tiers[number]['tier'] | undefined {
		const entry = this.cache.get(key);
		return entry?.tier;
	}

	/**
	 * Iterate this.cache values and use handleCacheEntry to get data
	 * @param {Tiers[number]['tier']} tier - cache tier to get values for
	 * @returns {AsyncIterable<Tiers[number]['data']>} Async iterable of cache values
	 */
	public tierValues(tier: Tiers[number]['tier']): AsyncIterable<Tiers[number]['data']> {
		const iterator = this.cache.entries();
		const currentTierResolve = this.handleCacheEntry.bind(this);
		return {
			[Symbol.asyncIterator]: () => {
				return {
					async next() {
						const {value, done} = iterator.next();
						if (done) {
							return {value: undefined, done};
						}
						return {value: await currentTierResolve(value[0], tier, value[1]), done};
					},
				};
			},
		};
	}

	/**
	 * Iterate this.cache entries and use handleCacheEntry to get data
	 * @param {Tiers[number]['tier']} tier - cache tier to get entries for
	 * @returns {AsyncIterable<[Key, Tiers[number]['data']]>} Async iterable of key-value pairs
	 */
	public tierEntries(tier: Tiers[number]['tier']): AsyncIterable<[Key, Tiers[number]['data']]> {
		const iterator = this.cache.entries();
		const currentTierResolve = this.handleCacheEntry.bind(this);
		return {
			[Symbol.asyncIterator]: () => {
				return {
					async next() {
						const {value, done} = iterator.next();
						if (done) {
							return {value, done: true};
						}
						return {value: [value[0], await currentTierResolve(value[0], tier, value[1])], done: false};
					},
				};
			},
		};
	}

	public keys(): Iterable<Key> {
		return this.cache.keys();
	}

	public has(key: Key) {
		this.logger.logKey('has', `MultiTierCache ${this.cacheName} has: '${String(key)}'`);
		return this.cache.has(key);
	}

	public size() {
		this.logger.logKey('size', `MultiTierCache ${this.cacheName} size: ${this.cache.size.toString()}`);
		return this.cache.size;
	}

	public clear() {
		const keys = new Set(this.cache.keys());
		this.clearAllTimeouts();
		this.cache.clear();
		this.logger.logKey('clear', `MultiTierCache ${this.cacheName} clear`);
		this.emit('delete', keys);
		this.emit('clear');
		this.emit('update', this.buildStatus(true));
	}

	public delete(key: Key): boolean {
		const isDeleted = this.handleDeleteValue(key);
		if (isDeleted) {
			this.logger.logKey('delete', `MultiTierCache ${this.cacheName} delete: '${String(key)}'`);
			this.emit('delete', [key]);
			this.emit('update', this.buildStatus(true));
		}
		return isDeleted;
	}

	public deleteKeys(keys: Iterable<Key>): number {
		const deleteKeys: Key[] = [];
		for (const key of keys) {
			this.clearTimeoutKey(key);
			if (this.cache.delete(key)) {
				deleteKeys.push(key);
			}
		}
		this.logger.logKey('delete', `MultiTierCache ${this.cacheName} deleteKeys (count: ${deleteKeys.length.toString()})`);
		this.emit('delete', deleteKeys);
		this.emit('update', this.buildStatus(true));
		return deleteKeys.length;
	}

	public status(): Readonly<TieredCacheStatus<Tiers>> {
		return this.buildStatus(false);
	}

	protected buildStatus(rebuild: boolean): Readonly<TieredCacheStatus<Tiers>> {
		if (!rebuild) {
			return this.statusData;
		}
		this.statusData = Object.freeze({
			size: this.cache.size,
			tiers: Array.from(this.cache.values()).reduce<TierStatusRecord<Tiers>>(
				(acc, {tier: type}) => {
					acc[type as keyof TierStatusRecord<Tiers>]++;
					return acc;
				},
				{...this.getInitialStatusData()},
			),
		});
		return this.statusData;
	}

	/**
	 * Internal helper to set cache entry and set timeout
	 * @param {Key} key - cache entry key
	 * @param {T['tier']} tier - cache entry tier
	 * @param {T['data']} data - cache entry data
	 * @param {TimeoutEnum} [timeout] - timeout value, optional
	 */
	protected async handleSetValue<T extends Tiers[number]>(key: Key, tier: T['tier'], data: T['data'], timeout?: TimeoutEnum) {
		this.cache.set(key, {tier, data});
		this.setTimeout(key, timeout ?? (await this.handleTimeoutValue(key, tier, data)));
	}

	/**
	 * Internal helper to delete cache entry and cancel its timeout
	 * @param {Key} key - cache entry key
	 * @returns true if entry was deleted, false if not found
	 */
	protected handleDeleteValue(key: Key): boolean {
		this.clearTimeoutKey(key);
		return this.cache.delete(key);
	}

	private logCacheName() {
		this.logger.logKey('constructor', `MultiTierCache ${this.cacheName} created`);
	}

	private setTimeout(key: Key, timeout: number | undefined) {
		const oldTimeout = this.cacheTimeout.get(key);
		if (oldTimeout) {
			clearTimeout(oldTimeout);
		}
		if (timeout !== undefined) {
			this.cacheTimeout.set(
				key,
				setTimeout(() => void this.runTimeout(key), timeout),
			);
			this.logger.logKey('setTimeout', `MultiTierCache ${this.cacheName} setTimeout: '${String(key)}' = timeouts: ${timeout.toString()}`);
		}
	}

	private clearTimeoutKey(key: Key) {
		const oldTimeout = this.cacheTimeout.get(key);
		if (oldTimeout) {
			this.logger.logKey('clearTimeoutKey', `MultiTierCache ${this.cacheName} clearTimeoutKey: '${String(key)}'`);
			clearTimeout(oldTimeout);
		}
		this.cacheTimeout.delete(key);
	}

	private clearAllTimeouts() {
		for (const timeout of this.cacheTimeout.values()) {
			if (timeout) {
				clearTimeout(timeout);
			}
		}
		this.cacheTimeout.clear();
	}

	private async runTimeout(key: Key) {
		try {
			const timeoutValue = await this.handleTierTimeout(key);
			if (timeoutValue === undefined) {
				this.logger.logKey('runTimeout', `MultiTierCache ${this.cacheName} runTimeout: '${String(key)}' cleared`);
				this.clearTimeoutKey(key);
			} else {
				this.logger.logKey('runTimeout', `MultiTierCache ${this.cacheName} runTimeout: '${String(key)}' cleared, new timeout: ${timeoutValue.toString()}`);
				this.setTimeout(key, timeoutValue);
			}
			this.emit('update', this.buildStatus(true));
			/* v8 ignore next 3 */
		} catch (error) {
			this.logger.error(error);
		}
	}

	protected abstract handleCacheEntry<T extends Tiers[number]>(
		key: Key,
		tier: T['tier'],
		cache: Tiers[number] | undefined,
	): Promise<T['data'] | undefined> | T['data'] | undefined;
	/**
	 * this return new timeout value for cached entry based on tier (or undefined if tier doesn't have timeout)
	 * @example
	 * // if tier not care about data and just want to return default timeouts
	 * protected handleTimeoutValue<T extends DateCacheTiers[number]>(key: Key, tier: T['type'], _data: T['data']) {
	 *   return this.handleTierDefaultTimeout(tier); // else make logic based on data (i.e. newer data should have longer timeout)
	 * }
	 */
	protected abstract handleTimeoutValue<T extends Tiers[number]>(key: Key, tier: T['tier'], data: T['data']): Promise<number | undefined> | number | undefined;
	/**
	 * this handle should change value of cache entry to another shape and return next tier default timeout (can also delete entry)
	 */
	protected abstract handleTierTimeout(key: Key): Promise<number | undefined> | number | undefined;
	/**
	 * If request didn't specify timeout, this method should return default timeout for tier or undefined if tier doesn't have timeout.
	 */
	protected abstract handleTierDefaultTimeout(type: Tiers[number]['tier']): TimeoutEnum | undefined;

	/**
	 * Build initial status data for cache
	 * @example
	 * protected getInitialStatusData(): Readonly<TierStatusInitialRecord<DateCacheTiers>>  {
	 * 	return {model: 0, object: 0, stringValue: 0} as const;
	 * }
	 */
	protected abstract getInitialStatusData(): Readonly<TierStatusInitialRecord<Tiers>>;
}

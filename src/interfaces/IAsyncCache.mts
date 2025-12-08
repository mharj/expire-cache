/**
 * Async callback type for when entries are expired or cleared
 */
export type IAsyncCacheOnClearCallback<Payload, Key = string> = (entries: Map<Key, Payload>) => Promise<void>;

/**
 * Asynchronous cache interface
 * @deprecated Use ```import {type IAsyncCache} from '@luolapeikko/cache-types';``` instead.
 * @example
 * function foo(cache: IAsyncCache<string>) {
 *   const value = await cache.get('key');
 *   await cache.set('key', 'value');
 *   await cache.has('key'); // true
 *   await cache.delete('key');
 *   await cache.clear();
 *   await cache.size(); // 0
 * }
 */
export interface IAsyncCache<Payload, Key = string> {
	/**
	 * Gets a value from the cache
	 * @param key - The key to get the value for
	 * @returns {Promise<Payload | undefined>} Promise of the cached value or undefined if not found
	 */
	get(key: Key): Promise<Payload | undefined>;
	/**
	 * Sets a value in the cache with an optional expiration date
	 * @param key - The key to set the value for
	 * @param value - The data to set in the cache
	 * @param expires - The optional expiration date for the cache entry
	 * @returns {Promise<void>} Promise of void
	 */
	set(key: Key, value: Payload, expires?: Date): Promise<void>;
	/**
	 * Deletes a value from the cache
	 * @param key - The key to delete the value for
	 * @returns {Promise<boolean>} Promise of true if the value was deleted, false otherwise
	 */
	delete(key: Key): Promise<boolean>;
	/**
	 * Checks if a key exists in the cache
	 * @param key - The key to check for
	 * @returns {Promise<boolean>} Promise of true if the key exists in the cache, false otherwise
	 */
	has(key: Key): Promise<boolean>;
	/**
	 * Get key expiration Date object or undefined if not found in cache
	 * @param key - The key to get the expiration for
	 * @returns {Promise<Date | undefined>} Promise of Date object or undefined if not found in cache
	 */
	expires(key: Key): Promise<Date | undefined>;
	/**
	 * Clear all cached values
	 */
	clear(): Promise<void>;
	/**
	 * Gets the number of items in the cache
	 * @returns {Promise<number>} Promise of the number of items in the cache
	 */
	size(): Promise<number>;

	/**
	 * Called when a entries are expired, deleted or cleared
	 */
	onClear(callback: IAsyncCacheOnClearCallback<Payload, Key>): void;

	/**
	 * Returns an async iterator of key, value pairs for every entry in the cache.
	 * @example
	 * for await (const [key, value] of cache.entries()) {
	 *   console.log(key, value);
	 * }
	 */
	entries(): AsyncIterableIterator<[Key, Payload]>;

	/**
	 * Async iterator for cache keys
	 * @example
	 * for await (const key of cache.keys()) {
	 *   console.log(key);
	 * }
	 */
	keys(): AsyncIterableIterator<Key>;

	/**
	 * Async iterator for cache values
	 * @example
	 * for await (const value of cache.values()) {
	 *   console.log(value);
	 * }
	 */
	values(): AsyncIterableIterator<Payload>;
}

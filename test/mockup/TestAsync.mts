import type {CacheEventsMap, IAsyncCache} from '@luolapeikko/cache-types';
import {EventEmitter} from 'events';

function makeAsyncIterable<T>(iterable: IterableIterator<T>): AsyncIterableIterator<T> {
	const asyncIterator = {
		[Symbol.asyncIterator]() {
			return {
				next() {
					return Promise.resolve(iterable.next());
				},
				return() {
					if (typeof iterable.return === 'function') {
						return Promise.resolve(iterable.return());
					}
					return Promise.resolve({done: true, value: undefined});
				},
				throw(error: unknown) {
					if (typeof iterable.throw === 'function') {
						return Promise.resolve(iterable.throw(error));
					}
					return Promise.reject(error as Error);
				},
			};
		},
	};

	return asyncIterator as AsyncIterableIterator<T>;
}

export class TestAsync<Payload, Key = string> extends EventEmitter<CacheEventsMap<Payload, Key>> implements IAsyncCache<Payload, Key> {
	private readonly cache = new Map<Key, Payload>();
	private readonly cacheTtl = new Map<Key, number | undefined>();
	private defaultExpireMs: undefined | number;

	public constructor(defaultExpireMs?: number) {
		super();
		this.defaultExpireMs = defaultExpireMs;
	}

	public set(key: Key, data: Payload, expires?: Date) {
		const expireTs: number | undefined = this.getExpireDate(expires)?.getTime();
		this.emit('set', key, data, this.getExpireDate(expires));
		this.cache.set(key, data);
		this.cacheTtl.set(key, expireTs);
		return Promise.resolve();
	}

	public get(key: Key) {
		this.emit('get', key);
		this.cleanExpired();
		return Promise.resolve(this.cache.get(key));
	}

	public has(key: Key) {
		this.cleanExpired();
		return Promise.resolve(this.cache.has(key));
	}

	public expires(key: Key) {
		const expires = this.cacheTtl.get(key);
		this.cleanExpired();
		return Promise.resolve(expires ? new Date(expires) : undefined);
	}

	public delete(key: Key) {
		const entry = this.cache.get(key);
		if (entry) {
			this.notifyExpires(new Map<Key, Payload>([[key, entry]]));
			this.emit('delete', key);
		}
		this.cacheTtl.delete(key);
		return Promise.resolve(this.cache.delete(key));
	}

	public clear() {
		const copy = new Map<Key, Payload>(this.cache);
		this.notifyExpires(copy);
		this.emit('clear', copy);
		this.cache.clear();
		this.cacheTtl.clear();
	}

	public size(): Promise<number> {
		return Promise.resolve(this.cache.size);
	}

	public entries(): AsyncIterableIterator<[Key, Payload]> {
		return makeAsyncIterable(this.cache.entries());
	}

	public keys(): AsyncIterableIterator<Key> {
		return makeAsyncIterable(this.cache.keys());
	}

	public values(): AsyncIterableIterator<Payload> {
		return makeAsyncIterable(this.cache.values());
	}

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

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {type GetCacheTier, TieredCache, type TierStatusInitialRecord, type TierType} from '../../src/index.mjs';

type DateCacheTiers = [TierType<Date, 'model'>, TierType<{$cdate: number}, 'object'>, TierType<string, 'stringValue'>];
type DataCacheTier = DateCacheTiers[number];

export const DateTimeout = {
	Model: 100,
	Object: 100,
	StringValue: 100,
} as const;

type DateTimeoutValue = (typeof DateTimeout)[keyof typeof DateTimeout];

export class DateTieredCache extends TieredCache<DateCacheTiers, DateTimeoutValue, string> implements GetCacheTier<DateCacheTiers, string> {
	public readonly cacheName = 'DateTieredCache';

	public getModel(_key: string, cache: DataCacheTier): Date {
		switch (cache.tier) {
			case 'model':
				return cache.data;
			case 'object':
				return new Date(cache.data.$cdate);
			case 'stringValue':
				return new Date(JSON.parse(cache.data)?.$cdate);
		}
	}

	public getStringValue(_key: string, cache: DataCacheTier): string {
		switch (cache.tier) {
			case 'model':
				return JSON.stringify({$cdate: cache.data.getTime()});
			case 'object':
				return JSON.stringify({$cdate: new Date(cache.data.$cdate).getTime()});
			case 'stringValue':
				return cache.data;
		}
	}

	public getObject(_key: string, cache: DataCacheTier): {$cdate: number} {
		switch (cache.tier) {
			case 'model':
				return {$cdate: cache.data.getTime()};
			case 'object':
				return cache.data;
			case 'stringValue':
				return JSON.parse(cache.data);
		}
	}

	protected handleCacheEntry<CT extends DataCacheTier>(key: string, targetTier: CT['tier'], cacheEntry: DataCacheTier | undefined): CT['data'] | undefined {
		if (!cacheEntry) {
			// cache = {tier: 'model', data: new Date()}; // on database usage, we can lookup still with key and build new entry for cache here.
			// this.handleSetValue(key, 'model', cache.data); // and also optionally set it here
			return;
		}
		switch (targetTier) {
			case 'model':
				return this.getModel(key, cacheEntry);
			case 'object':
				return this.getObject(key, cacheEntry);
			case 'stringValue':
				return this.getStringValue(key, cacheEntry);
			default:
				throw new Error(`Invalid tier ${String(targetTier)}`);
		}
	}

	protected handleTimeoutValue<CT extends DateCacheTiers[number]>(key: string, tier: CT['tier'], _data: CT['data']) {
		return this.handleTierDefaultTimeout(tier);
	}

	protected async handleTierTimeout(key: string) {
		const cache = this.cache.get(key);
		if (cache) {
			switch (cache.tier) {
				case 'model':
					await this.handleSetValue(key, 'object', {$cdate: cache.data.getTime()});
					return this.handleTierDefaultTimeout('object');
				case 'object':
					await this.handleSetValue(key, 'stringValue', new Date(cache.data.$cdate).getTime().toString());
					return this.handleTierDefaultTimeout('stringValue');
				case 'stringValue':
					this.cache.delete(key);
			}
		}
		return undefined;
	}

	protected handleTierDefaultTimeout(type: 'object' | 'model' | 'stringValue') {
		switch (type) {
			case 'model':
				return DateTimeout.Model;
			case 'object':
				return DateTimeout.Object;
			case 'stringValue':
				return DateTimeout.StringValue;
		}
	}

	protected getInitialStatusData(): Readonly<TierStatusInitialRecord<DateCacheTiers>> {
		return {model: 0, object: 0, stringValue: 0} as const;
	}
}

# @avanio/expire-cache

[![TypeScript](https://badges.frapsoft.com/typescript/code/typescript.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)
[![npm version](https://badge.fury.io/js/@avanio%2Fexpire-cache.svg)](https://badge.fury.io/js/@avanio%2Fexpire-cache)
[![Maintainability](https://qlty.sh/gh/mharj/projects/expire-cache/maintainability.svg)](https://qlty.sh/gh/mharj/projects/expire-cache)
[![Code Coverage](https://qlty.sh/gh/mharj/projects/expire-cache/coverage.svg)](https://qlty.sh/gh/mharj/projects/expire-cache)
![github action](https://github.com/mharj/expire-cache/actions/workflows/main.yml/badge.svg?branch=main)

Typescript/Javascript cache interfaces and expiration cache class.

This package contains:

- **_[ICache](./src/interfaces/ICache.ts)_** a common cache interface
- **_[IAsyncCache](./src/interfaces/IAsyncCache.ts)_** a common async cache interface
- **_[ICacheOrAsync](./src/interfaces/ICacheOrAsync.ts)_** a type for both cache interfaces
- **_[ExpireCache](./src/ExpireCache.ts)_** a class which implements the ICache interface with value expiration

## examples

### Synchronous example:

```typescript
import {ICache, ExpireCache, ExpireTimeoutCache} from '@avanio/expire-cache';

const cache = new ExpireCache<string>(); // expiration on read operations
const cache = new ExpireTimeoutCache<string>(); // expiration with setTimeout

cache.onClear((cleared) => {
	for (const [key, value] of cleared.entries()) {
		console.log(`key ${String(key)} expired, deleted or clear with value ${value}`);
	}
});

cache.add('key', 'value', new Date(Date.now() + 1000)); // expires in 1000ms
cache.add('key2', 'value2'); // never expires (if no default expiration is set)

cache.get('key'); // 'value'

cache.has('key'); // true

cache.delete('key');

cache.clear();

cache.size(); // 1

function useCache(cache: ICache<string>) {
	const value = cache.get('key'); // 'value'
}
```

### Synchronous/Asynchronous example (works with both ICache and IAsyncCache interfaces):

```typescript
import {ICacheOrAsync} from '@avanio/expire-cache';

function useCache(cache: ICacheOrAsync<string>) {
	const value = await cache.get('key'); // 'value'
}
```

### Advanced logging example, see [default log mapping](./src/ExpireCache.ts#L4)

```typescript
const cache = new ExpireCache<string>(console, {
	get: LogLevel.Info,
	set: LogLevel.Info,
});
```

### (Optional) default expiration in milliseconds if not specified in add() method. (If both are undefined, cache entry never expires):

```typescript
const cache = new ExpireCache<string>(console, undefined, 60 * 1000); // sets default 60 seconds expiration for add() method
```

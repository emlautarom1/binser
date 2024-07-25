# Binser

Binary serialization of arbitrary JS data structures[^1], ideal for sending data over the network (ex. `WebSockets`)

Inspired by Haskell's [binary](https://hackage.haskell.org/package/binary)

## Examples

```js
// Define a struct
const player = struct({
  x: int32,
  y: int32,
});
// Allocate an `ArrayBufferLike` with enough space
const buffer = new ArrayBuffer(player.size);
// Serialize and read instances
player.write(buffer, { x: 42, y: 24 });
player.read(buffer);
```

## Tests

```shell
npm run test
```

---

[^1] Some data structures cannot be supported like arbitrary functions or circular data structures.

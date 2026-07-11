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

### Dynamically sized arrays

Fixed-size types expose a static `size`. Dynamically sized types — like
`dynamicArray`, whose length is stored in the buffer — instead expose
`byteLength(value)` to compute the space a given value needs:

```js
// A length-prefixed array that round-trips any number of elements
const scores = dynamicArray(int32);
const values = [10, 20, 30];

const buffer = new ArrayBuffer(scores.byteLength(values));
scores.write(buffer, values);
scores.read(buffer); // [10, 20, 30]
```

The length prefix defaults to `uint32`; pass a second argument for a smaller
prefix (e.g. `dynamicArray(int32, uint8)` for arrays of up to 255 elements).
`dynamicArray` composes with `struct`, `array`, and `union`, and may be nested,
so a `struct` holding one (or a `dynamicArray` of `dynamicArray`s) works too —
allocate those with `byteLength(value)` as well.

## Tests

```shell
npm run test
```

[^1]: Some data structures cannot be supported like arbitrary functions or self referencing structs.

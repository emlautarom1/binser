import assert from "node:assert";
import { describe, it } from "node:test";
import { array, bool, dynamicArray, float64, int32, struct, uint8, uint32, union } from "./index.js";

describe("binser", () => {
  describe("int32", () => {
    it("should read and write", () => {
      const buffer = new ArrayBuffer(int32.size);
      int32.write(buffer, 4242);
      assert.equal(int32.read(buffer), 4242);
    });
  });

  describe("struct", () => {
    it("should read and write", () => {
      const player = struct({
        x: int32,
        y: int32,
      });
      const buffer = new ArrayBuffer(player.size);

      player.write(buffer, { x: 42, y: 24 });
      assert.deepEqual(player.read(buffer), { x: 42, y: 24 });
    });
  });

  describe("array", () => {
    it("should read and write multiple elements", () => {
      const intArray = array(2, int32);
      const buffer = new ArrayBuffer(intArray.size);

      intArray.write(buffer, [42, 24]);
      assert.deepEqual(intArray.read(buffer), [42, 24]);
    })
  });

  describe("union", () => {
    it("should read and write union variants", () => {
      const structUnion = union({
        foo: struct({ x: int32, y: bool }),
        bar: float64,
      });
      const buffer = new ArrayBuffer(structUnion.size);

      structUnion.write(buffer, { foo: { x: 42, y: true } });
      assert.deepEqual(structUnion.read(buffer), { foo: { x: 42, y: true } });
    });
  });

  describe("nested", () => {
    it("should read and write", () => {
      const player = struct({
        x: int32,
        y: int32,
        alive: bool,
        keys: array(4, bool),
        health: float64,
        permissions: union({
          admin: uint8,
          user: int32,
        }),
      });
      const game = array(2, player);
      const buffer = new ArrayBuffer(game.size);

      let gameInstance = [
        { x: 42, y: 24, alive: true, keys: [true, false, true, false], health: 42.42, permissions: { admin: 1 } },
        { x: 24, y: 42, alive: false, keys: [false, true, false, true], health: 24.24, permissions: { user: 13 } },
      ];
      game.write(buffer, gameInstance);
      assert.deepEqual(game.read(buffer), gameInstance);
    });
  });

  describe("uint32", () => {
    it("should read and write", () => {
      const buffer = new ArrayBuffer(uint32.size);
      uint32.write(buffer, 4_000_000_000);
      assert.equal(uint32.read(buffer), 4_000_000_000);
    });
  });

  describe("dynamicArray", () => {
    it("should read and write a variable number of elements", () => {
      const ints = dynamicArray(int32);
      const data = [42, 24, 7];
      const buffer = new ArrayBuffer(ints.byteLength(data));

      ints.write(buffer, data);
      assert.deepEqual(ints.read(buffer), data);
    });

    it("should round-trip different lengths with the same codec", () => {
      const ints = dynamicArray(int32);

      for (const data of [[], [1], [1, 2, 3, 4, 5]]) {
        const buffer = new ArrayBuffer(ints.byteLength(data));
        ints.write(buffer, data);
        assert.deepEqual(ints.read(buffer), data);
      }
    });

    it("should read and write an empty array", () => {
      const ints = dynamicArray(int32);
      const buffer = new ArrayBuffer(ints.byteLength([]));

      ints.write(buffer, []);
      assert.deepEqual(ints.read(buffer), []);
    });

    it("should support a custom length prefix type", () => {
      const ints = dynamicArray(int32, uint8);
      const data = [1, 2, 3];
      const buffer = new ArrayBuffer(ints.byteLength(data));

      assert.equal(ints.byteLength(data), 1 + 3 * int32.size);
      ints.write(buffer, data);
      assert.deepEqual(ints.read(buffer), data);
    });

    it("should throw when the length does not fit the prefix type", () => {
      const ints = dynamicArray(uint8, uint8);
      const data = new Array(256).fill(1);
      const buffer = new ArrayBuffer(ints.byteLength(data));

      assert.throws(() => ints.write(buffer, data), RangeError);
    });

    it("should hold structs (dynamic element type)", () => {
      const points = dynamicArray(struct({ x: int32, y: int32 }));
      const data = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ];
      const buffer = new ArrayBuffer(points.byteLength(data));

      points.write(buffer, data);
      assert.deepEqual(points.read(buffer), data);
    });

    it("should nest dynamic arrays of dynamic arrays", () => {
      const matrix = dynamicArray(dynamicArray(int32));
      const data = [[1, 2, 3], [], [4], [5, 6]];
      const buffer = new ArrayBuffer(matrix.byteLength(data));

      matrix.write(buffer, data);
      assert.deepEqual(matrix.read(buffer), data);
    });
  });

  describe("dynamicArray composition", () => {
    it("should be a field inside a struct", () => {
      const player = struct({
        id: int32,
        scores: dynamicArray(int32),
        alive: bool,
      });
      const data = { id: 7, scores: [10, 20, 30], alive: true };
      const buffer = new ArrayBuffer(player.byteLength(data));

      player.write(buffer, data);
      assert.deepEqual(player.read(buffer), data);
    });

    it("should offset correctly with fixed fields on both sides", () => {
      const message = struct({
        header: uint8,
        payload: dynamicArray(uint8),
        footer: int32,
      });
      const data = { header: 0xAB, payload: [1, 2, 3, 4, 5], footer: 42 };
      const buffer = new ArrayBuffer(message.byteLength(data));

      message.write(buffer, data);
      assert.deepEqual(message.read(buffer), data);
    });

    it("should be a union variant", () => {
      const packet = union({
        ping: uint8,
        list: dynamicArray(int32),
      });

      const listVal = { list: [1, 2, 3] };
      const buf1 = new ArrayBuffer(packet.byteLength(listVal));
      packet.write(buf1, listVal);
      assert.deepEqual(packet.read(buf1), listVal);

      const pingVal = { ping: 9 };
      const buf2 = new ArrayBuffer(packet.byteLength(pingVal));
      packet.write(buf2, pingVal);
      assert.deepEqual(packet.read(buf2), pingVal);
    });

    it("should hold structs that themselves contain dynamic arrays", () => {
      const room = struct({
        id: uint8,
        players: dynamicArray(struct({
          name: dynamicArray(uint8),
          hp: int32,
        })),
      });
      const data = {
        id: 3,
        players: [
          { name: [104, 105], hp: 100 },
          { name: [], hp: 50 },
        ],
      };
      const buffer = new ArrayBuffer(room.byteLength(data));

      room.write(buffer, data);
      assert.deepEqual(room.read(buffer), data);
    });
  });
})

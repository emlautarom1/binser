import assert from "node:assert";
import { describe, it } from "node:test";
import { array, bool, float64, int32, struct, uint8, union } from "./index.js";

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
})

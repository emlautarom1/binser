// A codec describes how to `read`/`write` a value at a byte `offset`.
//
// Fixed-size codecs expose a numeric `size` (the README allocates buffers with
// it). Dynamically sized codecs — whose byte length depends on the value — omit
// `size` and instead expose `byteLength(value)`. `$byteLength` unifies the two so
// that containers (`struct`, `array`, `union`) can hold either kind of codec.
function $byteLength(type, value) {
  return typeof type.byteLength === "function" ? type.byteLength(value) : type.size;
}

function $primitive(type, size) {
  return {
    size,
    read: (buffer, offset = 0) => new DataView(buffer)["get" + type](offset),
    write: (buffer, value, offset = 0) => new DataView(buffer)["set" + type](offset, value),
  }
}

export const uint8 = $primitive("Uint8", 1);
export const uint32 = $primitive("Uint32", 4);
export const int32 = $primitive("Int32", 4);
export const float64 = $primitive("Float64", 8);
export const bool = {
  size: uint8.size,
  read: (buffer, offset = 0) => !!uint8.read(buffer, offset),
  write: (buffer, value, offset = 0) => uint8.write(buffer, value ? 1 : 0, offset),
}

export function struct(fields) {
  const entries = Object.entries(fields);
  const fixed = entries.every(([_, v]) => typeof v.size === "number");

  return {
    // Only fixed structs have a meaningful static size; otherwise use byteLength.
    size: fixed ? entries.reduce((acc, [_, v]) => acc + v.size, 0) : undefined,
    byteLength: (value) => {
      let total = 0;
      for (const [k, v] of entries) {
        total += $byteLength(v, value[k]);
      }
      return total;
    },
    read: (buffer, offset = 0) => {
      const result = {};
      let currentOffset = offset;
      for (const [k, v] of entries) {
        result[k] = v.read(buffer, currentOffset);
        currentOffset += $byteLength(v, result[k]);
      }
      return result
    },
    write: (buffer, value, offset = 0) => {
      let currentOffset = offset;
      for (const [k, v] of entries) {
        v.write(buffer, value[k], currentOffset);
        currentOffset += $byteLength(v, value[k]);
      }
    }
  }
}

// Fixed-length array: exactly `length` elements. `type` may itself be dynamic,
// so offsets advance by each element's actual byte length.
export function array(length, type) {
  const fixed = typeof type.size === "number";

  return {
    size: fixed ? length * type.size : undefined,
    byteLength: (value) => {
      let total = 0;
      for (let i = 0; i < length; i++) {
        total += $byteLength(type, value[i]);
      }
      return total;
    },
    read: (buffer, offset = 0) => {
      const result = [];
      let currentOffset = offset;
      for (let i = 0; i < length; i++) {
        const value = type.read(buffer, currentOffset);
        result.push(value);
        currentOffset += $byteLength(type, value);
      }
      return result;
    },
    write: (buffer, value, offset = 0) => {
      let currentOffset = offset;
      for (let i = 0; i < length; i++) {
        type.write(buffer, value[i], currentOffset);
        currentOffset += $byteLength(type, value[i]);
      }
    }
  }
}

// Dynamically sized array: a length prefix (encoded with `lengthType`) followed
// by that many elements. Unlike `array`, the element count lives in the buffer,
// so the same codec round-trips arrays of any length.
export function dynamicArray(type, lengthType = uint32) {
  return {
    // Dynamically sized: no static `size`. Allocate with `byteLength(value)`.
    byteLength: (value) => {
      let total = lengthType.size;
      for (let i = 0; i < value.length; i++) {
        total += $byteLength(type, value[i]);
      }
      return total;
    },
    read: (buffer, offset = 0) => {
      const length = lengthType.read(buffer, offset);
      const result = [];
      let currentOffset = offset + lengthType.size;
      for (let i = 0; i < length; i++) {
        const value = type.read(buffer, currentOffset);
        result.push(value);
        currentOffset += $byteLength(type, value);
      }
      return result;
    },
    write: (buffer, value, offset = 0) => {
      lengthType.write(buffer, value.length, offset);
      // Guard against a length that silently overflows the prefix type
      // (e.g. >255 elements with a `uint8` prefix would wrap to garbage).
      if (lengthType.read(buffer, offset) !== value.length) {
        throw new RangeError(`dynamicArray: length ${value.length} does not fit in the length prefix type`);
      }
      let currentOffset = offset + lengthType.size;
      for (let i = 0; i < value.length; i++) {
        type.write(buffer, value[i], currentOffset);
        currentOffset += $byteLength(type, value[i]);
      }
    }
  }
}

export function union(variants) {
  const keys = Object.keys(variants);
  const fixed = keys.every(k => typeof variants[k].size === "number");

  return {
    // The discriminator is a single `uint8` byte before the variant payload.
    size: fixed ? keys.reduce((max, k) => Math.max(max, variants[k].size), 0) + 1 : undefined,
    byteLength: (value) => {
      const type = Object.keys(value)[0];
      return 1 + $byteLength(variants[type], value[type]);
    },
    read: (buffer, offset = 0) => {
      const discriminator = uint8.read(buffer, offset);
      const type = keys[discriminator];
      return { [type]: variants[type].read(buffer, offset + 1) };
    },
    write: (buffer, value, offset = 0) => {
      const type = Object.keys(value)[0];
      const discriminator = keys.indexOf(type);
      uint8.write(buffer, discriminator, offset);
      variants[type].write(buffer, value[type], offset + 1);
    }
  }
}
